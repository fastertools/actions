import { ChildProcess } from 'child_process'
import * as core from '@actions/core'

export interface HealthCheckOptions {
  timeoutSeconds?: number
  intervalMs?: number
  expectedStatus?: number
  requestTimeoutMs?: number
}

export interface ProcessOptions {
  timeoutMs?: number
  forceful?: boolean
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForHealthCheck(
  url: string,
  options: HealthCheckOptions = {}
): Promise<void> {
  const {
    timeoutSeconds = 30,
    intervalMs = 2000,
    expectedStatus,
    requestTimeoutMs
  } = options

  const timeoutMs = timeoutSeconds * 1000
  const maxAttempts = Math.ceil(timeoutMs / intervalMs) + 1

  core.info('⏳ Waiting for server to be ready...')

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController()

      // Set request timeout if specified - but only create timer, don't rely on it for successful case
      let requestTimeout: NodeJS.Timeout | undefined
      if (requestTimeoutMs && requestTimeoutMs > 0) {
        requestTimeout = setTimeout(() => {
          controller.abort()
        }, requestTimeoutMs)
      }

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })

      // Clear request timeout immediately after successful response
      if (requestTimeout) {
        clearTimeout(requestTimeout)
      }

      if (response.ok) {
        // Check expected status if provided
        if (expectedStatus && response.status !== expectedStatus) {
          // Status doesn't match, continue waiting
        } else {
          core.info('✅ Server health check passed')
          return
        }
      }

      // HTTP error or wrong status, continue retrying
    } catch (error) {
      // Network error or timeout, continue retrying
    }

    // If this isn't the last attempt, wait before retrying
    if (attempt < maxAttempts - 1) {
      await delay(intervalMs)
    }
  }

  throw new Error(`Server health check failed after ${timeoutSeconds}s timeout`)
}

export async function killProcessGracefully(
  process: ChildProcess,
  options: ProcessOptions = {}
): Promise<void> {
  const { timeoutMs = 10000, forceful = true } = options

  // Check if process is already terminated
  if (process.killed) {
    core.info('Process is already terminated')
    return
  }

  // Check if PID is available
  if (!process.pid) {
    throw new Error('Cannot kill process: PID is undefined')
  }

  return new Promise((resolve, reject) => {
    // Set up exit handler
    process.on('exit', () => {
      core.info('Process exited gracefully')
      resolve()
    })

    // Try graceful shutdown with SIGTERM
    core.info('Attempting graceful shutdown (SIGTERM)...')

    const killResult = process.kill('SIGTERM')
    if (!killResult) {
      reject(new Error(`Failed to send SIGTERM to process ${process.pid}`))
      return
    }

    // Set timeout for forceful kill
    const timeout = setTimeout(() => {
      if (forceful) {
        core.warning(
          'Process did not exit gracefully, forcing termination (SIGKILL)...'
        )
        process.kill('SIGKILL')
        resolve()
      } else {
        core.warning(
          'Process did not exit within timeout, but forceful termination is disabled'
        )
        resolve()
      }
    }, timeoutMs)

    // Clear timeout if process exits gracefully
    process.on('exit', () => {
      clearTimeout(timeout)
    })
  })
}

export async function spawnAsync(
  command: string,
  args: string[]
): Promise<ChildProcess> {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🚀 Stub spawn: ${command} ${args.join(' ')}`)
  return {} as ChildProcess
}

export function setupProcessCleanup(processes: ChildProcess[]): void {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🧹 Stub process cleanup for ${processes.length} processes`)
}
