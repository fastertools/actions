import * as core from '@actions/core'

export interface OAuthConfig {
  url: string
  clientId: string
  clientSecret: string
  scope?: string
}

export interface OAuthToken {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export async function obtainOAuthToken(config: OAuthConfig): Promise<OAuthToken> {
  const { url, clientId, clientSecret, scope = 'deploy' } = config
  
  // Mask sensitive credentials immediately
  core.setSecret(clientId)
  core.setSecret(clientSecret)
  
  try {
    // Prepare the request body
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)
    params.append('scope', scope)
    
    // Make the OAuth request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params
    })
    
    if (!response.ok) {
      throw new Error(`OAuth authentication failed: ${response.status} ${response.statusText}`)
    }
    
    const tokenResponse = await response.json() as any
    
    // Extract and mask the access token
    const accessToken = tokenResponse.access_token
    if (accessToken) {
      core.setSecret(accessToken)
    }
    
    // Build the token object with defaults
    const token: OAuthToken = {
      accessToken: accessToken || '',
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresIn: tokenResponse.expires_in || 3600
    }
    
    return token
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`OAuth token acquisition failed: ${errorMessage}`)
  }
}

export function cacheOAuthToken(token: OAuthToken): void {
  const expiryTimestamp = Date.now() + (token.expiresIn * 1000)
  
  core.exportVariable('FTL_AUTH_TOKEN', token.accessToken)
  core.exportVariable('FTL_TOKEN_TYPE', token.tokenType)
  core.exportVariable('FTL_TOKEN_EXPIRES', expiryTimestamp.toString())
}

export function getCachedOAuthToken(): OAuthToken | null {
  const accessToken = process.env.FTL_AUTH_TOKEN
  const tokenType = process.env.FTL_TOKEN_TYPE
  const expiresString = process.env.FTL_TOKEN_EXPIRES
  
  // Check if all required fields are present
  if (!accessToken || !tokenType || !expiresString) {
    return null
  }
  
  // Parse and validate expiry timestamp
  const expiryTimestamp = parseInt(expiresString, 10)
  if (isNaN(expiryTimestamp)) {
    return null
  }
  
  // Check if token is expired
  const now = Date.now()
  if (expiryTimestamp <= now) {
    return null
  }
  
  // Calculate remaining seconds
  const remainingMs = expiryTimestamp - now
  const remainingSeconds = Math.floor(remainingMs / 1000)
  
  return {
    accessToken,
    tokenType,
    expiresIn: remainingSeconds
  }
}

// Legacy class interface for backward compatibility
export interface AuthOptions {
  clientId?: string
  clientSecret?: string
  interactive?: boolean
  scope?: string[]
}

export interface AuthToken {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export class FTLAuthClient {
  async authenticate(options: AuthOptions): Promise<AuthToken> {
    // CRAWL Phase: Minimal stub implementation
    console.log('🔐 Stub OAuth authentication', { options })
    return {
      accessToken: 'stub-token',
      tokenType: 'Bearer',
      expiresIn: 3600
    }
  }

  async validateToken(token: string): Promise<boolean> {
    // CRAWL Phase: Minimal stub implementation
    console.log('✅ Stub token validation', { tokenLength: token.length })
    return true
  }

  async refreshToken(token: string): Promise<AuthToken> {
    // CRAWL Phase: Minimal stub implementation
    console.log('🔄 Stub token refresh', { tokenLength: token.length })
    return {
      accessToken: 'refreshed-stub-token',
      tokenType: 'Bearer',
      expiresIn: 3600
    }
  }

  static fromEnvironment(): FTLAuthClient | null {
    // CRAWL Phase: Minimal stub implementation
    console.log('🌍 Stub environment authentication')
    return new FTLAuthClient()
  }
}