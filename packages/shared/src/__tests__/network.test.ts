import { downloadWithRetry, checkUrlExists, DownloadOptions } from '../network'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock external dependencies
jest.mock('fs/promises')
jest.mock('@actions/core')

const mockedFs = fs as jest.Mocked<typeof fs>

describe('Network Operations', () => {
  let mockFetch: jest.MockedFunction<typeof global.fetch>
  
  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
    global.fetch = mockFetch
    
    // Mock filesystem operations
    mockedFs.mkdir.mockResolvedValue(undefined)
    mockedFs.writeFile.mockResolvedValue()
    
    // Clear timers
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('downloadWithRetry', () => {
    test('succeeds on first attempt with valid response', async () => {
      const testData = new ArrayBuffer(100)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(testData)
      } as Response)

      const promise = downloadWithRetry('https://example.com/file.tar.gz', '/tmp/file.tar.gz')
      jest.runAllTimers()
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/file.tar.gz', {
        signal: expect.any(AbortSignal)
      })
      expect(mockedFs.writeFile).toHaveBeenCalledWith('/tmp/file.tar.gz', Buffer.from(testData))
    })

    test('retries with exponential backoff on network failure', async () => {
      // Mock first two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        } as Response)

      const options: DownloadOptions = {
        maxRetries: 3,
        backoffMs: 100
      }

      const promise = downloadWithRetry('https://example.com/file.tar.gz', '/tmp/file.tar.gz', options)
      
      // Fast-forward through retry delays
      jest.runAllTimers()
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    test('calculates correct exponential backoff delays', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        } as Response)

      const options: DownloadOptions = {
        maxRetries: 3,
        backoffMs: 1000  // 1 second base
      }

      const mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        (callback as () => void)()
        return {} as NodeJS.Timeout
      })

      await downloadWithRetry('https://example.com/file.tar.gz', '/tmp/file.tar.gz', options)

      // Check that setTimeout was called with exponential backoff: 1000ms, 2000ms
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)  // First retry: 1000 * 2^0
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000)  // Second retry: 1000 * 2^1
    })

    test('throws error after exhausting all retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'))

      const options: DownloadOptions = {
        maxRetries: 2,
        backoffMs: 100
      }

      const promise = downloadWithRetry('https://example.com/file.tar.gz', '/tmp/file.tar.gz', options)
      
      // Let the first attempt fail and advance to the second
      await Promise.resolve()
      jest.advanceTimersByTime(100) // First backoff delay
      await Promise.resolve()
      
      await expect(promise).rejects.toThrow('Download failed after 2 attempts: Persistent network error')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    test('handles HTTP error responses properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      const options: DownloadOptions = { maxRetries: 1 }
      const promise = downloadWithRetry('https://example.com/missing.tar.gz', '/tmp/file.tar.gz', options)
      jest.runAllTimers()

      await expect(promise).rejects.toThrow('Download failed after 1 attempts: HTTP 404: Not Found')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('enforces timeout on slow requests', async () => {
      // Mock a request that takes too long
      let resolveRequest: (value: any) => void
      mockFetch.mockImplementationOnce(() => new Promise(resolve => {
        resolveRequest = resolve
        // Don't resolve - this simulates a hanging request
      }))

      const options: DownloadOptions = {
        maxRetries: 1,
        timeout: 1000  // 1 second timeout
      }

      const promise = downloadWithRetry('https://slow.example.com/file.tar.gz', '/tmp/file.tar.gz', options)
      
      // Advance time to trigger the abort timeout
      jest.advanceTimersByTime(1001)
      
      // Should fail due to timeout/abort
      await expect(promise).rejects.toThrow()
    })

    test('creates directory if it does not exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      } as Response)

      await downloadWithRetry('https://example.com/file.tar.gz', '/deep/nested/path/file.tar.gz')

      expect(mockedFs.mkdir).toHaveBeenCalledWith('/deep/nested/path', { recursive: true })
    })

    test('uses default options when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      } as Response)

      await downloadWithRetry('https://example.com/file.tar.gz', '/tmp/file.tar.gz')

      // Should use defaults: maxRetries=3, backoffMs=5000, timeout=30000
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/file.tar.gz', {
        signal: expect.any(AbortSignal)
      })
    })
  })

  describe('checkUrlExists', () => {
    test('returns true for existing URL (HEAD request succeeds)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true
      } as Response)

      const exists = await checkUrlExists('https://example.com/existing-file.tar.gz')

      expect(exists).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/existing-file.tar.gz', { method: 'HEAD' })
    })

    test('returns false for non-existing URL (HEAD request fails)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      } as Response)

      const exists = await checkUrlExists('https://example.com/missing-file.tar.gz')

      expect(exists).toBe(false)
    })

    test('returns false when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const exists = await checkUrlExists('https://unreachable.example.com/file.tar.gz')

      expect(exists).toBe(false)
    })
  })
})