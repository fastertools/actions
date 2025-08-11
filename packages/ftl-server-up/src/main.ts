import * as core from '@actions/core'
import { healthCheck, setupProcessCleanup } from '@fastertools/shared'

async function run(): Promise<void> {
  try {
    core.startGroup('🚀 Starting FTL Server (TypeScript Skeleton)')
    
    const port = core.getInput('port') || '8080'
    const configFile = core.getInput('config-file')
    const timeout = parseInt(core.getInput('timeout') || '30', 10)
    
    core.info(`Port: ${port}`)
    core.info(`Config file: ${configFile || 'default'}`)
    core.info(`Timeout: ${timeout}s`)
    
    // CRAWL Phase: Simulate server startup
    core.info('Starting FTL server (skeleton)...')
    
    // Use shared utilities for process management
    setupProcessCleanup([])
    
    const serverUrl = `http://localhost:${port}`
    
    // Use shared utility for health check
    const healthy = await healthCheck(serverUrl, 3)
    core.info(`Health check result: ${healthy}`)
    
    // CRAWL Phase: Set skeleton outputs
    core.exportVariable('FTL_SERVER_URL', serverUrl)
    core.exportVariable('FTL_SERVER_PID', '12345')
    
    core.setOutput('server-url', serverUrl)
    core.setOutput('pid', 12345)
    core.setOutput('healthy', true)
    
    core.info('✅ FTL server started successfully (skeleton)')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(`Server startup failed: ${errorMessage}`)
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