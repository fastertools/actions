import * as core from '@actions/core'
import { obtainOAuthToken, cacheOAuthToken, getCachedOAuthToken, type OAuthToken } from '@fastertools/shared'

interface DeploymentResponse {
  deployment_id: string
  status: string
  url?: string
  error?: string
}

interface DeploymentStatusResponse {
  deployment_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
  url?: string
}

async function getAuthToken(clientId?: string, clientSecret?: string): Promise<string> {
  // First try to get cached token
  const cachedToken = getCachedOAuthToken()
  if (cachedToken) {
    return cachedToken.accessToken
  }
  
  // If no cached token, try to obtain new one
  if (clientId && clientSecret) {
    const oauthUrl = process.env.FTL_OAUTH_URL || 'https://api.ftl.dev/oauth/token'
    
    try {
      const token = await obtainOAuthToken({
        url: oauthUrl,
        clientId,
        clientSecret,
        scope: 'deploy'
      })
      
      // Cache the token for future use
      cacheOAuthToken(token)
      return token.accessToken
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Authentication failed: ${errorMessage}`)
    }
  }
  
  throw new Error('Authentication required. Provide client-id/client-secret or use authenticate-ftl action first.')
}

async function executeDeployment(project: string, environment: string, token: string, options: Record<string, any>): Promise<DeploymentResponse> {
  const apiUrl = process.env.FTL_API_URL || 'https://api.ftl.dev'
  const deployUrl = `${apiUrl}/projects/${project}/environments/${environment}/deploy`
  
  // Build request body
  const body: any = {
    project,
    environment
  }
  
  // Add optional parameters
  if (options.timeout) {
    const timeoutNum = parseInt(options.timeout, 10)
    if (!isNaN(timeoutNum)) {
      body.timeout = timeoutNum
    }
  }
  
  if (options['config-file']) {
    body.configFile = options['config-file']
  }
  
  try {
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage += ` - ${errorData.error}`
        }
      } catch {
        // Ignore JSON parsing errors for error responses
      }
      throw new Error(`Deployment failed: ${errorMessage}`)
    }
    
    try {
      return await response.json() as DeploymentResponse
    } catch (error) {
      throw new Error('Failed to parse deployment response: Invalid JSON')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Deployment failed:')) {
      throw error  // Re-throw formatted deployment errors
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Deployment request failed: ${errorMessage}`)
  }
}

async function waitForDeploymentCompletion(deploymentId: string, token: string, timeoutSeconds: number): Promise<DeploymentStatusResponse> {
  const apiUrl = process.env.FTL_API_URL || 'https://api.ftl.dev'
  const statusUrl = `${apiUrl}/deployments/${deploymentId}/status`
  const timeoutMs = timeoutSeconds * 1000
  const startTime = Date.now()
  const pollInterval = 10000  // 10 seconds
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`)
      }
      
      const status = await response.json() as DeploymentStatusResponse
      
      if (status.status === 'completed') {
        return status
      }
      
      if (status.status === 'failed') {
        const errorMsg = status.error || 'Deployment failed'
        throw new Error(`Deployment failed: ${errorMsg}`)
      }
      
      // Continue polling for in_progress or pending
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      if (error instanceof Error && error.message.includes('Deployment failed:')) {
        throw error  // Re-throw deployment failure errors
      }
      // Continue polling on network errors
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  throw new Error(`Deployment timed out after ${timeoutSeconds} seconds`)
}

async function run(): Promise<void> {
  try {
    core.startGroup('🚀 FTL Engineering Deploy')
    
    // Validate required inputs
    const project = core.getInput('project')
    if (!project) {
      throw new Error('Project name is required')
    }
    
    const environment = core.getInput('environment') || 'staging'
    const waitForCompletion = core.getBooleanInput('wait-for-completion')
    const clientId = core.getInput('client-id')
    const clientSecret = core.getInput('client-secret')
    
    // Get deployment timeout with validation
    const deploymentTimeoutInput = core.getInput('deployment-timeout')
    let deploymentTimeout = 300  // Default 5 minutes
    if (deploymentTimeoutInput) {
      const parsed = parseInt(deploymentTimeoutInput, 10)
      if (isNaN(parsed)) {
        core.warning('Invalid deployment-timeout value, using default (300 seconds)')
      } else {
        deploymentTimeout = parsed
      }
    }
    
    core.info(`Project: ${project}`)
    core.info(`Environment: ${environment}`)
    core.info(`Wait for completion: ${waitForCompletion}`)
    
    // Get authentication token
    const token = await getAuthToken(clientId, clientSecret)
    
    // Prepare deployment options
    const options: Record<string, any> = {}
    const timeout = core.getInput('timeout')
    const configFile = core.getInput('config-file')
    
    if (timeout) options.timeout = timeout
    if (configFile) options['config-file'] = configFile
    
    // Execute deployment
    core.info(`Deploying ${project} to ${environment}...`)
    const deployment = await executeDeployment(project, environment, token, options)
    
    // Set initial outputs
    core.setOutput('deployment-id', deployment.deployment_id)
    if (deployment.url) {
      core.setOutput('deployment-url', deployment.url)
    }
    core.setOutput('status', deployment.status)
    
    if (waitForCompletion) {
      core.info('Waiting for deployment to complete...')
      const finalStatus = await waitForDeploymentCompletion(deployment.deployment_id, token, deploymentTimeout)
      core.setOutput('status', finalStatus.status)
      if (finalStatus.url) {
        core.setOutput('deployment-url', finalStatus.url)
      }
    }
    
    // Generate summary
    const statusEmoji = '✅'
    const statusText = deployment.status === 'completed' ? 'completed' : 'pending'
    core.info(`${statusEmoji} Deployment ${statusText}${deployment.url ? `: ${deployment.url}` : ''}`)
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.setFailed(errorMessage)
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