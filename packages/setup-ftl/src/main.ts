import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

interface GitHubRelease {
  tag_name: string
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

function isValidSemver(version: string): boolean {
  if (version === 'latest') return true
  const semverRegex = /^\d+\.\d+\.\d+$/
  return semverRegex.test(version)
}

async function resolveVersion(version: string): Promise<string> {
  if (version === 'latest' || version === '') {
    try {
      const response = await fetch('https://api.github.com/repos/fastertools/ftl-cli/releases')
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`)
      }
      const releases = await response.json() as GitHubRelease[]
      // Find latest release with cli-v prefix
      const latestRelease = releases.find(r => r.tag_name.startsWith('cli-v'))
      if (!latestRelease) {
        throw new Error('No release found with cli-v prefix')
      }
      return latestRelease.tag_name.replace(/^cli-v/, '')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to resolve latest version: ${errorMessage}`)
    }
  }
  
  if (!isValidSemver(version)) {
    throw new Error(`Invalid version format: ${version}. Expected semver format (e.g., 1.0.0) or 'latest'`)
  }
  
  return version
}

function getBinaryUrl(version: string, platform: { os: string; arch: string }): string {
  // Map architecture
  const archMap: Record<string, string> = {
    'x64': 'x86_64',
    'arm64': 'aarch64'
  }
  const ftlArch = archMap[platform.arch] || platform.arch
  
  // Build asset name based on platform
  let assetName: string
  if (platform.os === 'darwin') {
    // macOS uses: ftl-{arch}-apple-darwin
    assetName = `ftl-${ftlArch}-apple-darwin`
  } else if (platform.os === 'linux') {
    // Linux uses: ftl-{arch}-unknown-linux-gnu
    assetName = `ftl-${ftlArch}-unknown-linux-gnu`
  } else {
    throw new Error(`Unsupported platform: ${platform.os}`)
  }
  
  const versionTag = `cli-v${version}`
  
  return `https://github.com/fastertools/ftl-cli/releases/download/${versionTag}/${assetName}`
}

async function installDependencies(): Promise<void> {
  core.info('💿 Installing dependencies...')
  try {
    // Install Spin CLI as a dependency
    // Use bash -c to handle the pipe properly
    await exec.exec('bash', ['-c', 'curl -fsSL https://developer.fermyon.com/downloads/install.sh | bash'])
    core.info('✅ Dependencies installed successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.warning(`Failed to install dependencies: ${errorMessage}`)
    // Don't fail the entire action for dependency installation failures
  }
}

async function run(): Promise<void> {
  try {
    core.startGroup('🏗️ Setting up FTL CLI')
    
    // Get inputs
    const versionInput = core.getInput('version') || 'latest'
    const useCache = core.getBooleanInput('use-cache')
    
    core.info(`Requested version: ${versionInput}`)
    core.info(`Use cache: ${useCache}`)
    
    // Detect platform
    const platform = detectPlatform()
    core.info(`Detected platform: ${platform.os}/${platform.arch} (${platform.runner})`)
    
    // Resolve version
    const version = await resolveVersion(versionInput)
    core.info(`Resolved version: ${version}`)
    
    let ftlPath = ''
    let cacheHit = false
    
    // Check cache if enabled
    if (useCache) {
      ftlPath = tc.find('ftl', version, platform.arch)
      if (ftlPath) {
        core.info(`📋 Found cached FTL CLI version ${version} at ${ftlPath}`)
        cacheHit = true
      }
    }
    
    // Download and install if not cached
    if (!ftlPath) {
      const downloadUrl = getBinaryUrl(version, platform)
      core.info(`Downloading FTL CLI from: ${downloadUrl}`)
      
      try {
        // Download the binary
        const downloadPath = await tc.downloadTool(downloadUrl)
        
        // The FTL CLI is distributed as a raw binary, not an archive
        // Create a directory for the binary
        const binDir = path.join(process.env.RUNNER_TEMP || '/tmp', `ftl-${version}`)
        await fs.mkdir(binDir, { recursive: true })
        
        // Move the binary to the directory with the correct name
        const ftlBinaryPath = path.join(binDir, 'ftl')
        await fs.copyFile(downloadPath, ftlBinaryPath)
        
        // Cache the directory containing the binary
        ftlPath = await tc.cacheDir(binDir, 'ftl', version, platform.arch)
        
        core.info(`💿 FTL CLI ${version} installed to ${ftlPath}`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          throw new Error(`Version ${version} not found. Please check if this version exists in the FTL releases.`)
        }
        
        if (errorMessage.includes('Network timeout') || errorMessage.includes('timeout')) {
          throw new Error(`Download failed: Network timeout. Please try again.`)
        }
        
        if (errorMessage.includes('Corrupted archive')) {
          throw new Error(`Extraction failed: ${errorMessage}`)
        }
        
        throw new Error(`Download failed: ${errorMessage}`)
      }
    }
    
    // Set executable permissions
    const ftlBinary = path.join(ftlPath, 'ftl')
    try {
      await fs.chmod(ftlBinary, '755')
    } catch (error) {
      core.warning(`Failed to set executable permissions: ${error}`)
    }
    
    // Add to PATH
    core.addPath(ftlPath)
    
    // Verify installation
    try {
      await exec.exec(ftlBinary, ['--version'])
      core.info('✅ FTL CLI installation verified')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`FTL CLI verification failed: ${errorMessage}`)
    }
    
    // Always install dependencies - they're called dependencies for a reason!
    await installDependencies()
    
    // Set outputs
    core.setOutput('version', version)
    core.setOutput('ftl-path', ftlPath)
    core.setOutput('cached', cacheHit.toString())
    
    core.info(`✅ FTL CLI setup completed successfully`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(`Setup failed: ${errorMessage}`)
  } finally {
    core.endGroup()
  }
}

// Export for testing
export { run }

// Run if this is the main module
if (require.main === module) {
  run()
}



export interface Platform {
  os: 'linux' | 'darwin' | 'win32'
  arch: 'x64' | 'arm64'
  runner: string
}

export function detectPlatform(): Platform {
  // Use GitHub Actions environment first
  const runnerOS = process.env.RUNNER_OS
  const runnerArch = process.env.RUNNER_ARCH
  
  let detectedOS: Platform['os']
  switch (runnerOS) {
    case 'Linux':
      detectedOS = 'linux'
      break
    case 'macOS':
      detectedOS = 'darwin'
      break
    case 'Windows':
      throw new Error(`Unsupported platform: ${runnerOS}`)
    case 'linux':  // Handle lowercase variants
      detectedOS = 'linux'
      break
    default:
      // Fallback to Node.js detection
      const nodeOS = os.platform()
      if (nodeOS === 'linux') detectedOS = 'linux'
      else if (nodeOS === 'darwin') detectedOS = 'darwin'
      else if (nodeOS === 'win32') throw new Error(`Unsupported platform: ${nodeOS}`)
      else throw new Error(`Unsupported platform: ${nodeOS}`)
  }
  
  let detectedArch: Platform['arch']
  switch (runnerArch) {
    case 'X64':
    case 'x64':
      detectedArch = 'x64'
      break
    case 'ARM64':
    case 'arm64':
      detectedArch = 'arm64'
      break
    case 'X86':
      throw new Error(`Unsupported architecture: ${runnerArch}`)
    default:
      // Fallback to Node.js detection
      const nodeArch = os.arch()
      if (nodeArch === 'x64') detectedArch = 'x64'
      else if (nodeArch === 'arm64') detectedArch = 'arm64'
      else throw new Error(`Unsupported architecture: ${nodeArch}`)
  }
  
  return {
    os: detectedOS,
    arch: detectedArch,
    runner: runnerOS || `${detectedOS}-${detectedArch}`
  }
}

export function getPlatformDownloadName(platform: Platform): string {
  const osMap = { linux: 'linux', darwin: 'darwin' }
  const archMap = { x64: 'x64', arm64: 'arm64' }
  
  if (platform.os === 'win32') {
    throw new Error(`Unsupported platform for download: ${platform.os}`)
  }
  
  return `ftl-${osMap[platform.os]}-${archMap[platform.arch]}.tar.gz`
}

export function getDownloadUrl(version: string, platform: Platform): string {
  const filename = getPlatformDownloadName(platform)
  return `https://github.com/TBD54566975/ftl/releases/download/v${version}/${filename}`
}