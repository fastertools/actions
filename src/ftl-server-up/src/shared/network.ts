import * as fs from 'fs/promises'
import * as path from 'path'

export interface DownloadOptions {
  maxRetries?: number
  backoffMs?: number
  timeout?: number
}

export async function downloadWithRetry(
  url: string,
  outputPath: string,
  options: DownloadOptions = {}
): Promise<void> {
  const { maxRetries = 3, backoffMs = 5000, timeout = 30000 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), timeout)

      try {
        // Make the HTTP request
        const response = await fetch(url, {
          signal: abortController.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Get the response data
        const data = await response.arrayBuffer()

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath)
        await fs.mkdir(dir, { recursive: true })

        // Write the file
        await fs.writeFile(outputPath, Buffer.from(data))

        return // Success!
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If this was the last attempt, don't wait
      if (attempt === maxRetries - 1) {
        break
      }

      // Calculate exponential backoff delay
      const delay = backoffMs * Math.pow(2, attempt)
      await new Promise<void>((resolve) => setTimeout(() => resolve(), delay))
    }
  }

  // If we get here, all attempts failed
  throw new Error(
    `Download failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  )
}

export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

export async function healthCheck(url: string, retries = 3): Promise<boolean> {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🔍 Stub health check: ${url} (retries: ${retries})`)
  return true
}
