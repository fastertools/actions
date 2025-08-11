import * as core from '@actions/core'
import { FTLAuthClient } from '@fastertools/shared'

async function run(): Promise<void> {
  try {
    core.startGroup('🔐 FTL Authentication (TypeScript Skeleton)')
    
    const method = core.getInput('method') || 'auto'
    const setOutput = core.getBooleanInput('set-output')
    
    core.info(`Authentication method: ${method}`)
    core.info(`Set output: ${setOutput}`)
    
    // CRAWL Phase: OAuth authentication
    const client = new FTLAuthClient()
    
    let token
    if (method === 'interactive') {
      core.info('Using interactive device flow (skeleton)')
      token = await client.authenticate({ interactive: true })
    } else {
      const clientId = core.getInput('client-id')
      const clientSecret = core.getInput('client-secret')
      
      if (!clientId || !clientSecret) {
        throw new Error('client-id and client-secret are required for non-interactive authentication')
      }
      
      core.info('Using client credentials flow (skeleton)')
      token = await client.authenticate({ clientId, clientSecret })
    }
    
    // Export token for subsequent actions
    core.exportVariable('FTL_AUTH_TOKEN', token.accessToken)
    core.setSecret(token.accessToken)
    
    // Optional: set as output
    if (setOutput) {
      core.setOutput('token', token.accessToken)
    }
    
    core.info('✅ Authentication successful. Token cached for workflow (skeleton).')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(`Authentication failed: ${errorMessage}`)
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