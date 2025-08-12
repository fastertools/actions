import { detectPlatform, getPlatformDownloadName } from '../platform'
import { Platform } from '../platform'

describe('Platform Detection', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.RUNNER_OS
    delete process.env.RUNNER_ARCH
    // Mock Node.js platform/arch
    jest.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    jest.spyOn(process, 'arch', 'get').mockReturnValue('x64')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('detectPlatform returns correct Linux x64 platform from GitHub Actions', () => {
    process.env.RUNNER_OS = 'Linux'
    process.env.RUNNER_ARCH = 'X64'

    const platform = detectPlatform()

    expect(platform).toEqual({
      os: 'linux',
      arch: 'x64',
      runner: 'Linux'
    })
  })

  test('detectPlatform returns correct macOS ARM64 platform from GitHub Actions', () => {
    process.env.RUNNER_OS = 'macOS'
    process.env.RUNNER_ARCH = 'ARM64'

    const platform = detectPlatform()

    expect(platform).toEqual({
      os: 'darwin',
      arch: 'arm64',
      runner: 'macOS'
    })
  })

  test('detectPlatform falls back to Node.js detection when GitHub Actions vars missing', () => {
    // No RUNNER_OS/RUNNER_ARCH set
    jest.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    jest.spyOn(process, 'arch', 'get').mockReturnValue('arm64')

    const platform = detectPlatform()

    expect(platform).toEqual({
      os: 'darwin',
      arch: 'arm64',
      runner: 'darwin-arm64'
    })
  })

  test('detectPlatform throws error for unsupported Windows platform', () => {
    process.env.RUNNER_OS = 'Windows'
    process.env.RUNNER_ARCH = 'X64'

    expect(() => detectPlatform()).toThrow('Unsupported platform: Windows')
  })

  test('detectPlatform throws error for unsupported architecture', () => {
    process.env.RUNNER_OS = 'Linux'
    process.env.RUNNER_ARCH = 'X86' // Unsupported 32-bit

    expect(() => detectPlatform()).toThrow('Unsupported architecture: X86')
  })

  test('detectPlatform normalizes architecture case variations', () => {
    // Test lowercase variations
    process.env.RUNNER_OS = 'Linux'
    process.env.RUNNER_ARCH = 'x64'

    const platform = detectPlatform()

    expect(platform.arch).toBe('x64')
  })

  test('detectPlatform handles mixed case OS names', () => {
    process.env.RUNNER_OS = 'linux' // lowercase
    process.env.RUNNER_ARCH = 'X64'

    const platform = detectPlatform()

    expect(platform.os).toBe('linux')
  })
})

describe('Platform Download Name Generation', () => {
  test('getPlatformDownloadName generates correct Linux x64 filename', () => {
    const platform: Platform = {
      os: 'linux',
      arch: 'x64',
      runner: 'Linux'
    }

    const downloadName = getPlatformDownloadName(platform)

    expect(downloadName).toBe('ftl-linux-x64.tar.gz')
  })

  test('getPlatformDownloadName generates correct macOS ARM64 filename', () => {
    const platform: Platform = {
      os: 'darwin',
      arch: 'arm64',
      runner: 'macOS'
    }

    const downloadName = getPlatformDownloadName(platform)

    expect(downloadName).toBe('ftl-darwin-arm64.tar.gz')
  })

  test('getPlatformDownloadName generates correct Linux ARM64 filename', () => {
    const platform: Platform = {
      os: 'linux',
      arch: 'arm64',
      runner: 'Linux'
    }

    const downloadName = getPlatformDownloadName(platform)

    expect(downloadName).toBe('ftl-linux-arm64.tar.gz')
  })

  test('getPlatformDownloadName throws error for unsupported Windows platform', () => {
    const platform: Platform = {
      os: 'win32' as any,
      arch: 'x64',
      runner: 'Windows'
    }

    expect(() => getPlatformDownloadName(platform)).toThrow(
      'Unsupported platform for download: win32'
    )
  })
})
