import * as core from '@actions/core'
import { obtainOAuthToken, cacheOAuthToken, getCachedOAuthToken, type OAuthToken } from '@fastertools/shared'

async function run(): Promise<void> {
  try {
    core.startGroup('🔐 FTL Authentication')
    
    const method = core.getInput('method') || 'auto'
    const setOutput = core.getBooleanInput('set-output')
    const clientId = core.getInput('client-id')
    const clientSecret = core.getInput('client-secret')
    
    core.info(`Authentication method: ${method}`)
    core.info(`Set output: ${setOutput}`)
    
    let token: OAuthToken
    
    // Try to get cached token first
    const cachedToken = getCachedOAuthToken()
    if (cachedToken && method === 'auto') {
      core.info('Using cached authentication token')
      token = cachedToken
    } else if (method === 'interactive') {
      throw new Error('Interactive authentication not yet supported - use client credentials')
    } else {
      // Client credentials flow
      if (!clientId || !clientSecret) {
        throw new Error('client-id and client-secret are required for non-interactive authentication')
      }
      
      core.info('Using client credentials flow')
      
      const oauthUrl = process.env.FTL_OAUTH_URL || 'https://api.ftl.dev/oauth/token'
      
      try {
        token = await obtainOAuthToken({
          url: oauthUrl,
          clientId,
          clientSecret,
          scope: 'deploy'
        })
        
        // Cache the token for future use
        cacheOAuthToken(token)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`OAuth authentication failed: ${errorMessage}`)
      }
    }
    
    // Export token for subsequent actions
    core.exportVariable('FTL_AUTH_TOKEN', token.accessToken)
    core.setSecret(token.accessToken)
    
    // Optional: set as output
    if (setOutput) {
      core.setOutput('token', token.accessToken)
    }
    
    // Set additional outputs
    core.setOutput('token-type', token.tokenType)
    core.setOutput('expires-in', token.expiresIn.toString())
    
    core.info('✅ Authentication successful. Token cached for workflow.')
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