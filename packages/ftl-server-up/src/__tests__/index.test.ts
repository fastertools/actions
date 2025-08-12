import { run } from '../index'
import * as core from '@actions/core'
import { spawn, ChildProcess } from 'child_process'
import { waitForHealthCheck, killProcessGracefully } from '@fastertools/shared'

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('child_process')
jest.mock('@fastertools/shared')

const mockedCore = core as jest.Mocked<typeof core>
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>
const mockedWaitForHealthCheck = waitForHealthCheck as jest.MockedFunction<typeof waitForHealthCheck>
const mockedKillProcessGracefully = killProcessGracefully as jest.MockedFunction<typeof killProcessGracefully>

describe('FTL Server Up Action', () => {
  let mockProcess: any
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Mock child process
    mockProcess = {
      pid: 12345,
      killed: false,
      kill: jest.fn(),
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    }
    mockedSpawn.mockReturnValue(mockProcess as ChildProcess)
    
    // Mock successful health check by default
    mockedWaitForHealthCheck.mockResolvedValue()
    
    // Mock process cleanup
    jest.spyOn(process, 'on').mockImplementation(() => process)
    
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('Server Startup', () => {
    test('starts FTL server with default configuration', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'timeout': '30'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith('ftl', ['serve', '--port', '8080'], {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      expect(mockedWaitForHealthCheck).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        { timeoutSeconds: 30 }
      )
    })

    test('starts server with custom port and config file', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '9000',
          'config-file': './custom-ftl.toml',
          'timeout': '60'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith(
        'ftl',
        ['serve', '--port', '9000', '--config', './custom-ftl.toml'],
        expect.any(Object)
      )

      expect(mockedWaitForHealthCheck).toHaveBeenCalledWith(
        'http://localhost:9000/health',
        { timeoutSeconds: 60 }
      )
    })

    test('includes additional command line arguments when provided', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'args': '--verbose --log-level debug'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith(
        'ftl',
        ['serve', '--port', '8080', '--verbose', '--log-level', 'debug'],
        expect.any(Object)
      )
    })

    test('handles custom working directory', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'working-directory': '/path/to/ftl/project'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith('ftl', ['serve', '--port', '8080'], {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/path/to/ftl/project'
      })
    })
  })

  describe('Process Management', () => {
    test('sets up process cleanup handlers', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      // Should register cleanup handlers
      expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function))
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    test('exports process information to environment', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_SERVER_URL', 'http://localhost:8080')
      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_SERVER_PID', '12345')
    })

    test('handles process startup failure', async () => {
      const errorProcess = {
        ...mockProcess,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Command not found: ftl')), 100)
          }
        })
      }
      mockedSpawn.mockReturnValue(errorProcess as ChildProcess)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      const promise = run()
      jest.runAllTimers()
      await promise

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Server startup failed: Command not found: ftl'
      )
    })

    test('handles process exit before health check', async () => {
      const exitingProcess = {
        ...mockProcess,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'exit') {
            setTimeout(() => callback(1), 100)  // Exit with error code
          }
        })
      }
      mockedSpawn.mockReturnValue(exitingProcess as ChildProcess)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      const promise = run()
      jest.runAllTimers()
      await promise

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'FTL server process exited unexpectedly with code 1'
      )
    })

    test('captures and logs server output', async () => {
      const outputProcess = {
        ...mockProcess,
        stdout: {
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('Server started successfully\n')), 50)
            }
          })
        },
        stderr: {
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('Loading configuration...\n')), 50)
            }
          })
        }
      }
      mockedSpawn.mockReturnValue(outputProcess as ChildProcess)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      const promise = run()
      jest.runAllTimers()
      await promise

      expect(mockedCore.info).toHaveBeenCalledWith('Server stdout: Server started successfully')
      expect(mockedCore.info).toHaveBeenCalledWith('Server stderr: Loading configuration...')
    })
  })

  describe('Health Check Integration', () => {
    test('waits for health check with default endpoint', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'timeout': '45'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedWaitForHealthCheck).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        { timeoutSeconds: 45 }
      )
    })

    test('uses custom health check endpoint when provided', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'health-endpoint': '/api/v1/status',
          'timeout': '30'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedWaitForHealthCheck).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/status',
        { timeoutSeconds: 30 }
      )
    })

    test('handles health check failure', async () => {
      mockedWaitForHealthCheck.mockRejectedValueOnce(
        new Error('Server health check failed after 30s timeout')
      )

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Server health check failed after 30s timeout'
      )
      expect(mockedKillProcessGracefully).toHaveBeenCalledWith(mockProcess, expect.any(Object))
    })

    test('skips health check when disabled', async () => {
      mockedCore.getBooleanInput.mockImplementation((name: string) => {
        return name === 'skip-health-check'
      })

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedWaitForHealthCheck).not.toHaveBeenCalled()
      expect(mockedCore.info).toHaveBeenCalledWith(
        '⚠️ Skipping health check as requested'
      )
    })

    test('configures health check with custom HTTP method', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'health-method': 'POST',
          'health-body': '{"ping": "server"}'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedWaitForHealthCheck).toHaveBeenCalledWith(
        'http://localhost:8080/health',
        {
          timeoutSeconds: 30,
          method: 'POST',
          body: '{"ping": "server"}'
        }
      )
    })
  })

  describe('Input Validation', () => {
    test('validates port number range', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '99999'  // Invalid port
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Invalid port number: 99999. Port must be between 1 and 65535.'
      )
    })

    test('validates timeout value', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'timeout': 'not-a-number'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.warning).toHaveBeenCalledWith(
        'Invalid timeout value, using default (30 seconds)'
      )
    })

    test('validates config file path exists', async () => {
      const fs = require('fs/promises')
      jest.mock('fs/promises')
      const mockedFs = fs as jest.Mocked<typeof fs>
      mockedFs.access = jest.fn().mockRejectedValue(new Error('ENOENT'))

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'config-file': './non-existent-ftl.toml'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Configuration file not found: ./non-existent-ftl.toml'
      )
    })

    test('uses default port when not specified', async () => {
      mockedCore.getInput.mockReturnValue('')  // No inputs provided

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith(
        'ftl',
        ['serve', '--port', '8080'],  // Default port
        expect.any(Object)
      )
    })
  })

  describe('Environment Variables', () => {
    test('passes through FTL-specific environment variables', async () => {
      process.env.FTL_CONFIG = '/path/to/config'
      process.env.FTL_LOG_LEVEL = 'debug'

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith('ftl', ['serve', '--port', '8080'], {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          FTL_CONFIG: '/path/to/config',
          FTL_LOG_LEVEL: 'debug'
        })
      })

      delete process.env.FTL_CONFIG
      delete process.env.FTL_LOG_LEVEL
    })

    test('sets custom environment variables from input', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '8080',
          'env-vars': 'DATABASE_URL=postgres://localhost:5432/ftl,LOG_LEVEL=info'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedSpawn).toHaveBeenCalledWith('ftl', ['serve', '--port', '8080'], {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          DATABASE_URL: 'postgres://localhost:5432/ftl',
          LOG_LEVEL: 'info'
        })
      })
    })
  })

  describe('Output Generation', () => {
    test('sets all required outputs on successful startup', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'port': '9090',
          'timeout': '45'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setOutput).toHaveBeenCalledWith('server-url', 'http://localhost:9090')
      expect(mockedCore.setOutput).toHaveBeenCalledWith('pid', 12345)
      expect(mockedCore.setOutput).toHaveBeenCalledWith('status', 'running')
    })

    test('generates server startup summary', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.info).toHaveBeenCalledWith(
        '✅ FTL server started successfully at http://localhost:8080'
      )
    })

    test('includes process information in summary', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.info).toHaveBeenCalledWith(
        'Server process ID: 12345'
      )
    })
  })

  describe('Cleanup and Error Handling', () => {
    test('cleans up process on action failure', async () => {
      mockedWaitForHealthCheck.mockRejectedValueOnce(new Error('Health check failed'))

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      expect(mockedKillProcessGracefully).toHaveBeenCalledWith(mockProcess, {
        timeoutMs: 10000,
        forceful: true
      })
    })

    test('handles cleanup function registration', async () => {
      const mockProcessOn = jest.spyOn(process, 'on')

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      // Extract the cleanup function and test it
      const cleanupFn = mockProcessOn.mock.calls.find(call => call[0] === 'exit')?.[1] as Function
      expect(cleanupFn).toBeDefined()

      // Call cleanup function
      cleanupFn()

      expect(mockedCore.info).toHaveBeenCalledWith('🧹 Cleaning up FTL server process...')
    })

    test('handles process that is already dead during cleanup', async () => {
      mockProcess.killed = true
      
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = { 'port': '8080' }
        return inputs[name] || ''
      })

      await run()

      // Trigger cleanup
      const mockProcessOn = jest.spyOn(process, 'on')
      const cleanupFn = mockProcessOn.mock.calls.find(call => call[0] === 'exit')?.[1] as Function
      cleanupFn()

      // Should not attempt to kill already dead process
      expect(mockedKillProcessGracefully).not.toHaveBeenCalled()
    })
  })
})