import { waitForHealthCheck, killProcessGracefully, ProcessOptions, HealthCheckOptions } from '../process'
import * as core from '@actions/core'

// Mock @actions/core
jest.mock('@actions/core')
const mockedCore = core as jest.Mocked<typeof core>

describe('Process Management', () => {
  let mockFetch: jest.MockedFunction<typeof global.fetch>
  
  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
    global.fetch = mockFetch
    
    mockedCore.info.mockClear()
    mockedCore.warning.mockClear()
    
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

  describe('waitForHealthCheck', () => {
    test('succeeds when health check passes immediately', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' })
      } as Response)

      const options: HealthCheckOptions = {
        timeoutSeconds: 30,
        intervalMs: 2000,
        expectedStatus: 200
      }

      await waitForHealthCheck('http://localhost:8080/health', options)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/health', {
        method: 'GET',
        signal: expect.any(AbortSignal)
      })
      expect(mockedCore.info).toHaveBeenCalledWith('✅ Server health check passed')
    })

    test('retries with correct interval when health check initially fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        } as Response)

      const options: HealthCheckOptions = {
        timeoutSeconds: 10,
        intervalMs: 1000
      }

      const promise = waitForHealthCheck('http://localhost:8080/health', options)
      
      // Let the first attempt fail
      await flushPromises()
      
      // Run first retry timer
      jest.runAllTimers()
      await flushPromises()
      
      // Run second retry timer  
      jest.runAllTimers()
      await flushPromises()
      
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockedCore.info).toHaveBeenCalledWith('⏳ Waiting for server to be ready...')
    })

    test('throws timeout error when health check never succeeds', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      const options: HealthCheckOptions = {
        timeoutSeconds: 5,
        intervalMs: 1000
      }

      const promise = waitForHealthCheck('http://localhost:8080/health', options)
      
      // Let the first attempt start and fail
      await Promise.resolve()
      
      // Run through all retry attempts (5 more retries: 1s, 2s, 3s, 4s, 5s)
      for (let i = 0; i < 5; i++) {
        jest.runOnlyPendingTimers()
        await Promise.resolve()
      }

      await expect(promise).rejects.toThrow(
        'Server health check failed after 5s timeout'
      )
      
      // Should try multiple times during timeout period
      expect(mockFetch).toHaveBeenCalledTimes(6) // 0s, 1s, 2s, 3s, 4s, 5s
    })

    test('handles HTTP error status codes properly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        } as Response)

      const options: HealthCheckOptions = {
        timeoutSeconds: 10,
        intervalMs: 1000
      }

      const promise = waitForHealthCheck('http://localhost:8080/health', options)
      
      // Let first attempt complete, then trigger retry
      await Promise.resolve()
      jest.advanceTimersByTime(1000)
      
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('validates response status code when expectedStatus provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 201  // Wrong status code
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200  // Correct status code
        } as Response)

      const options: HealthCheckOptions = {
        timeoutSeconds: 10,
        intervalMs: 1000,
        expectedStatus: 200
      }

      const promise = waitForHealthCheck('http://localhost:8080/health', options)
      
      // Let first attempt complete, then trigger retry
      await Promise.resolve()
      jest.advanceTimersByTime(1000)
      
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('validates custom health check path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      const customPath = 'http://localhost:8080/api/v1/status'
      await waitForHealthCheck(customPath)

      expect(mockFetch).toHaveBeenCalledWith(customPath, expect.any(Object))
    })

    test('uses default options when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await waitForHealthCheck('http://localhost:8080/health')

      // Should use defaults: timeoutSeconds=30, intervalMs=2000
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8080/health', {
        method: 'GET',
        signal: expect.any(AbortSignal)
      })
    })

    test('respects request timeout on individual health checks', async () => {
      // Mock a request that never resolves but can be aborted
      mockFetch.mockImplementationOnce((url, options) => {
        return new Promise((resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new Error('AbortError'))
            })
          }
          // Never resolve this promise unless aborted
        })
      })

      const options: HealthCheckOptions = {
        timeoutSeconds: 1,
        intervalMs: 500,
        requestTimeoutMs: 100  // Very short timeout for individual requests
      }

      const promise = waitForHealthCheck('http://localhost:8080/health', options)
      
      // Let the request start 
      await Promise.resolve()
      
      // Advance to trigger the request timeout
      jest.runOnlyPendingTimers()

      await expect(promise).rejects.toThrow()
    })
  })

  describe('killProcessGracefully', () => {
    let mockProcess: any

    beforeEach(() => {
      mockProcess = {
        pid: 1234,
        killed: false,
        kill: jest.fn(),
        on: jest.fn()
      }
    })

    test('kills process with SIGTERM first, then SIGKILL if needed', async () => {
      // Mock process doesn't exit gracefully
      mockProcess.kill.mockReturnValue(true)
      mockProcess.killed = false

      // Simulate process not exiting after SIGTERM
      let exitCallback: () => void = () => {}
      mockProcess.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'exit') {
          exitCallback = callback
        }
      })

      const options: ProcessOptions = {
        timeoutMs: 1000,
        forceful: true
      }

      const promise = killProcessGracefully(mockProcess, options)
      
      // Simulate timeout - process doesn't exit
      jest.advanceTimersByTime(1000)
      
      await promise

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL')
      expect(mockedCore.info).toHaveBeenCalledWith('Attempting graceful shutdown (SIGTERM)...')
      expect(mockedCore.warning).toHaveBeenCalledWith('Process did not exit gracefully, forcing termination (SIGKILL)...')
    })

    test('succeeds with SIGTERM when process exits gracefully', async () => {
      mockProcess.kill.mockReturnValue(true)

      // Simulate process exiting after SIGTERM
      mockProcess.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'exit') {
          // Immediately call exit callback
          setTimeout(callback, 100)
        }
      })

      const options: ProcessOptions = {
        timeoutMs: 5000,
        forceful: true
      }

      const promise = killProcessGracefully(mockProcess, options)
      jest.runAllTimers()
      await promise

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockProcess.kill).not.toHaveBeenCalledWith('SIGKILL')
      expect(mockedCore.info).toHaveBeenCalledWith('Process exited gracefully')
    })

    test('throws error when process kill fails', async () => {
      mockProcess.kill.mockReturnValue(false)  // Kill command failed

      const options: ProcessOptions = {
        timeoutMs: 1000
      }

      await expect(killProcessGracefully(mockProcess, options)).rejects.toThrow(
        'Failed to send SIGTERM to process 1234'
      )
    })

    test('handles process that is already killed', async () => {
      mockProcess.killed = true

      const promise = killProcessGracefully(mockProcess)
      await promise

      expect(mockProcess.kill).not.toHaveBeenCalled()
      expect(mockedCore.info).toHaveBeenCalledWith('Process is already terminated')
    })

    test('handles missing PID gracefully', async () => {
      mockProcess.pid = undefined

      await expect(killProcessGracefully(mockProcess)).rejects.toThrow(
        'Cannot kill process: PID is undefined'
      )
    })

    test('uses default timeout when none provided', async () => {
      mockProcess.kill.mockReturnValue(true)
      mockProcess.killed = false

      // Don't exit gracefully to test timeout
      mockProcess.on.mockImplementation(() => {})

      const promise = killProcessGracefully(mockProcess)
      jest.advanceTimersByTime(10000)  // Default should be 10 seconds
      await promise

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL')
    })

    test('does not force kill when forceful option is false', async () => {
      mockProcess.kill.mockReturnValue(true)
      mockProcess.killed = false
      mockProcess.on.mockImplementation(() => {})  // Process never exits

      const options: ProcessOptions = {
        timeoutMs: 1000,
        forceful: false
      }

      const promise = killProcessGracefully(mockProcess, options)
      jest.advanceTimersByTime(1000)
      await promise

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM')
      expect(mockProcess.kill).not.toHaveBeenCalledWith('SIGKILL')
      expect(mockedCore.warning).toHaveBeenCalledWith(
        'Process did not exit within timeout, but forceful termination is disabled'
      )
    })
  })
})