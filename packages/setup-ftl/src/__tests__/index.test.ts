import { run } from '../main'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import { detectPlatform, downloadWithRetry } from '@fastertools/shared'

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('@actions/tool-cache')
jest.mock('@actions/exec')
jest.mock('@fastertools/shared')

const mockedCore = core as jest.Mocked<typeof core>
const mockedTc = tc as jest.Mocked<typeof tc>
const mockedExec = exec as jest.Mocked<typeof exec>
const mockedDetectPlatform = detectPlatform as jest.MockedFunction<typeof detectPlatform>
const mockedDownloadWithRetry = downloadWithRetry as jest.MockedFunction<typeof downloadWithRetry>

describe('Setup FTL Action', () => {
  let mockFetch: jest.MockedFunction<typeof global.fetch>
  
  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
    global.fetch = mockFetch
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Mock default platform
    mockedDetectPlatform.mockReturnValue({
      os: 'linux',
      arch: 'x64',
      runner: 'Linux'
    })
    
    // Mock successful tool-cache operations
    mockedTc.find.mockReturnValue('')  // No cached version initially
    mockedTc.downloadTool.mockResolvedValue('/tmp/ftl.tar.gz')
    mockedTc.extractTar.mockResolvedValue('/tmp/extracted')
    mockedTc.cacheDir.mockResolvedValue('/opt/hostedtoolcache/ftl/1.0.0/x64')
    
    // Mock successful exec operations
    mockedExec.exec.mockResolvedValue(0)
    
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('Version Resolution', () => {
    test('resolves "latest" to actual version from GitHub API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          tag_name: 'v1.2.3',
          assets: [{
            name: 'ftl-linux-x64.tar.gz',
            browser_download_url: 'https://github.com/TBD54566975/ftl/releases/download/v1.2.3/ftl-linux-x64.tar.gz'
          }]
        })
      } as Response)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': 'latest',
          'install-dependencies': 'false'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/repos/TBD54566975/ftl/releases/latest')
      expect(mockedCore.setOutput).toHaveBeenCalledWith('ftl-version', '1.2.3')
    })

    test('uses specific version when provided', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.5',
          'install-dependencies': 'false'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockFetch).not.toHaveBeenCalled()  // Should not hit GitHub API
      expect(mockedTc.downloadTool).toHaveBeenCalledWith(
        'https://github.com/TBD54566975/ftl/releases/download/v1.0.5/ftl-linux-x64.tar.gz'
      )
    })

    test('validates semver format for specific versions', async () => {
      mockedCore.getInput.mockReturnValue('invalid-version-format')

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Invalid version format: invalid-version-format')
      )
    })

    test('handles GitHub API failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API rate limit exceeded'))

      mockedCore.getInput.mockImplementation((name: string) => {
        return name === 'version' ? 'latest' : ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve latest version')
      )
    })
  })

  describe('Platform-Specific Installation', () => {
    test('installs correct binary for Linux x64', async () => {
      mockedDetectPlatform.mockReturnValue({
        os: 'linux',
        arch: 'x64',
        runner: 'Linux'
      })

      mockedCore.getInput.mockReturnValue('1.0.0')

      await run()

      expect(mockedTc.downloadTool).toHaveBeenCalledWith(
        'https://github.com/TBD54566975/ftl/releases/download/v1.0.0/ftl-linux-x64.tar.gz'
      )
    })

    test('installs correct binary for macOS ARM64', async () => {
      mockedDetectPlatform.mockReturnValue({
        os: 'darwin',
        arch: 'arm64',
        runner: 'macOS'
      })

      mockedCore.getInput.mockReturnValue('1.0.0')

      await run()

      expect(mockedTc.downloadTool).toHaveBeenCalledWith(
        'https://github.com/TBD54566975/ftl/releases/download/v1.0.0/ftl-darwin-arm64.tar.gz'
      )
    })

    test('fails gracefully for unsupported platform', async () => {
      mockedDetectPlatform.mockImplementation(() => {
        throw new Error('Unsupported platform: Windows')
      })

      mockedCore.getInput.mockReturnValue('1.0.0')

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported platform: Windows')
      )
    })
  })

  describe('Caching Behavior', () => {
    test('uses cached version when available', async () => {
      mockedTc.find.mockReturnValue('/opt/hostedtoolcache/ftl/1.0.0/x64')  // Cache hit

      mockedCore.getInput.mockImplementation((name: string) => {
        return name === 'version' ? '1.0.0' : ''
      })

      await run()

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringContaining('Found cached FTL CLI')
      )
      expect(mockedTc.downloadTool).not.toHaveBeenCalled()  // Should not download
      expect(mockedCore.setOutput).toHaveBeenCalledWith('ftl-version', '1.0.0')
    })

    test('downloads and caches when not in cache', async () => {
      mockedTc.find.mockReturnValue('')  // Cache miss

      mockedCore.getInput.mockImplementation((name: string) => {
        return name === 'version' ? '1.1.0' : ''
      })

      await run()

      expect(mockedTc.downloadTool).toHaveBeenCalled()
      expect(mockedTc.extractTar).toHaveBeenCalled()
      expect(mockedTc.cacheDir).toHaveBeenCalledWith(
        '/tmp/extracted',
        'ftl',
        '1.1.0',
        'x64'
      )
    })

    test('respects use-cache input parameter', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.0',
          'use-cache': 'false'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedTc.find).not.toHaveBeenCalled()  // Should skip cache check
      expect(mockedTc.downloadTool).toHaveBeenCalled()
    })
  })

  describe('Installation Verification', () => {
    test('verifies FTL CLI works after installation', async () => {
      mockedCore.getInput.mockReturnValue('1.0.0')
      mockedExec.exec.mockResolvedValueOnce(0)  // Successful --version check

      await run()

      expect(mockedExec.exec).toHaveBeenCalledWith(
        expect.stringContaining('ftl'),
        ['--version']
      )
    })

    test('fails when FTL CLI verification fails', async () => {
      mockedCore.getInput.mockReturnValue('1.0.0')
      mockedExec.exec.mockRejectedValueOnce(new Error('Command not found'))

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('FTL CLI verification failed')
      )
    })

    test('sets executable permissions on downloaded binary', async () => {
      const fs = require('fs/promises')
      const mockedFs = fs as jest.Mocked<typeof fs>
      jest.mock('fs/promises')
      mockedFs.chmod = jest.fn().mockResolvedValue(undefined)

      mockedCore.getInput.mockReturnValue('1.0.0')

      await run()

      // Should set executable permissions (chmod +x)
      expect(mockedFs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('ftl'),
        '755'
      )
    })
  })

  describe('Dependencies Installation', () => {
    test('installs Spin when install-dependencies is true', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.0',
          'install-dependencies': 'true'
        }
        return inputs[name] || ''
      })

      mockedCore.getBooleanInput.mockImplementation((name: string) => {
        return name === 'install-dependencies'
      })

      await run()

      // Should call additional dependency installation
      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringContaining('Installing dependencies')
      )
    })

    test('skips dependencies when install-dependencies is false', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.0',
          'install-dependencies': 'false'
        }
        return inputs[name] || ''
      })

      mockedCore.getBooleanInput.mockReturnValue(false)

      await run()

      expect(mockedCore.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Installing dependencies')
      )
    })

    test('handles dependency installation failures gracefully', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.0',
          'install-dependencies': 'true'
        }
        return inputs[name] || ''
      })

      mockedCore.getBooleanInput.mockReturnValue(true)
      
      // Mock dependency installation failure
      mockedExec.exec.mockResolvedValueOnce(0)  // FTL install succeeds
      mockedExec.exec.mockRejectedValueOnce(new Error('Spin install failed'))  // Dependency fails

      await run()

      expect(mockedCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install dependencies')
      )
      // Should not fail the entire action
      expect(mockedCore.setFailed).not.toHaveBeenCalled()
    })
  })

  describe('Input Validation', () => {
    test('handles missing version input with default', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        return name === 'version' ? '' : ''  // Empty version
      })

      await run()

      // Should default to 'latest'
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/TBD54566975/ftl/releases/latest'
      )
    })

    test('validates boolean inputs properly', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'version': '1.0.0',
          'install-dependencies': 'invalid-boolean'
        }
        return inputs[name] || ''
      })

      await run()

      // Should handle invalid boolean gracefully (default to false)
      expect(mockedCore.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Installing dependencies')
      )
    })
  })

  describe('Error Handling', () => {
    test('handles download failures with appropriate error messages', async () => {
      mockedCore.getInput.mockReturnValue('1.0.0')
      mockedTc.downloadTool.mockRejectedValueOnce(new Error('Network timeout'))

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Download failed: Network timeout')
      )
    })

    test('handles extraction failures', async () => {
      mockedCore.getInput.mockReturnValue('1.0.0')
      mockedTc.extractTar.mockRejectedValueOnce(new Error('Corrupted archive'))

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Extraction failed: Corrupted archive')
      )
    })

    test('provides actionable error messages for common failures', async () => {
      mockedCore.getInput.mockReturnValue('999.999.999')  // Non-existent version
      mockedTc.downloadTool.mockRejectedValueOnce(new Error('HTTP 404'))

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Version 999.999.999 not found')
      )
    })
  })

  describe('Output Generation', () => {
    test('sets all required outputs on successful installation', async () => {
      mockedCore.getInput.mockReturnValue('1.5.0')
      mockedTc.cacheDir.mockResolvedValue('/path/to/ftl')

      await run()

      expect(mockedCore.setOutput).toHaveBeenCalledWith('ftl-version', '1.5.0')
      expect(mockedCore.setOutput).toHaveBeenCalledWith('ftl-path', expect.stringContaining('/path/to/ftl'))
      expect(mockedCore.setOutput).toHaveBeenCalledWith('cache-hit', 'false')
    })

    test('indicates cache hit in outputs when using cached version', async () => {
      mockedTc.find.mockReturnValue('/cached/ftl/path')
      mockedCore.getInput.mockReturnValue('1.0.0')

      await run()

      expect(mockedCore.setOutput).toHaveBeenCalledWith('cache-hit', 'true')
    })

    test('adds FTL to PATH', async () => {
      mockedCore.getInput.mockReturnValue('1.0.0')
      mockedTc.cacheDir.mockResolvedValue('/path/to/ftl')

      await run()

      expect(mockedCore.addPath).toHaveBeenCalledWith('/path/to/ftl')
    })
  })
})