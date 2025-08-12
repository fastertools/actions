import * as os from 'os'

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
    case 'linux': // Handle lowercase variants
      detectedOS = 'linux'
      break
    default:
      // Fallback to Node.js detection
      const nodeOS = os.platform()
      if (nodeOS === 'linux') detectedOS = 'linux'
      else if (nodeOS === 'darwin') detectedOS = 'darwin'
      else if (nodeOS === 'win32')
        throw new Error(`Unsupported platform: ${nodeOS}`)
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
