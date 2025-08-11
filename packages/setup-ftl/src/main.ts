import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as fs from 'fs/promises'
import { detectPlatform } from '@fastertools/shared'

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
      const response = await fetch('https://api.github.com/repos/TBD54566975/ftl/releases/latest')
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`)
      }
      const release = await response.json() as GitHubRelease
      return release.tag_name.replace(/^v/, '')
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

function getBinaryUrl(version: string, os: string, arch: string): string {
  const versionTag = version.startsWith('v') ? version : `v${version}`
  return `https://github.com/TBD54566975/ftl/releases/download/${versionTag}/ftl-${os}-${arch}.tar.gz`
}

async function installDependencies(): Promise<void> {
  core.info('💿 Installing dependencies...')
  try {
    // Install Spin CLI as a dependency
    await exec.exec('curl', ['-fsSL', 'https://developer.fermyon.com/downloads/install.sh', '|', 'bash'])
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
    const installDeps = core.getBooleanInput('install-dependencies')
    
    core.info(`Requested version: ${versionInput}`)
    core.info(`Use cache: ${useCache}`)
    core.info(`Install dependencies: ${installDeps}`)
    
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
      const downloadUrl = getBinaryUrl(version, platform.os, platform.arch)
      core.info(`Downloading FTL CLI from: ${downloadUrl}`)
      
      try {
        // Download the binary
        const downloadPath = await tc.downloadTool(downloadUrl)
        
        // Extract the archive
        const extractedPath = await tc.extractTar(downloadPath)
        
        // Cache the extracted files
        ftlPath = await tc.cacheDir(extractedPath, 'ftl', version, platform.arch)
        
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
    
    // Install dependencies if requested
    if (installDeps) {
      await installDependencies()
    }
    
    // Set outputs
    core.setOutput('ftl-version', version)
    core.setOutput('ftl-path', ftlPath)
    core.setOutput('cache-hit', cacheHit.toString())
    
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