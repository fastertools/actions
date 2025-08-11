import * as core from '@actions/core'
import { detectPlatform } from '@fastertools/shared'

async function run(): Promise<void> {
  try {
    core.startGroup('🏗️ Setting up FTL CLI (TypeScript Skeleton)')
    
    const version = core.getInput('version') || 'latest'
    const useCache = core.getBooleanInput('use-cache')
    
    core.info(`Requested version: ${version}`)
    core.info(`Use cache: ${useCache}`)
    
    // CRAWL Phase: Detect platform using shared utility
    const platform = detectPlatform()
    core.info(`Detected platform: ${platform.os}/${platform.arch} (${platform.runner})`)
    
    // CRAWL Phase: Set skeleton outputs
    core.setOutput('ftl-path', '/tmp/ftl-skeleton')
    core.setOutput('version', '0.0.0-skeleton')
    core.setOutput('cached', 'false')
    
    core.info('✅ FTL CLI setup completed (skeleton)')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(`Setup failed: ${errorMessage}`)
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