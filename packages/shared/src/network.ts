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
  // CRAWL Phase: Minimal stub implementation
  console.log(`📥 Stub download: ${url} -> ${outputPath}`, { options })
}

export async function healthCheck(url: string, retries = 3): Promise<boolean> {
  // CRAWL Phase: Minimal stub implementation
  console.log(`🔍 Stub health check: ${url} (retries: ${retries})`)
  return true
}