import { obtainOAuthToken, cacheOAuthToken, getCachedOAuthToken, OAuthConfig, OAuthToken } from '../oauth'
import * as core from '@actions/core'

// Mock @actions/core
jest.mock('@actions/core')
const mockedCore = core as jest.Mocked<typeof core>

describe('OAuth Authentication', () => {
  let mockFetch: jest.MockedFunction<typeof global.fetch>
  
  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
    global.fetch = mockFetch
    
    // Reset core mocks
    mockedCore.setSecret.mockClear()
    mockedCore.exportVariable.mockClear()
    
    // Clear environment variables
    delete process.env.FTL_AUTH_TOKEN
    delete process.env.FTL_TOKEN_TYPE
    delete process.env.FTL_TOKEN_EXPIRES
    
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('obtainOAuthToken', () => {
    test('returns valid token with correct credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'real-access-token-12345',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'deploy'
      }

      const token = await obtainOAuthToken(config)

      expect(token).toEqual({
        accessToken: 'real-access-token-12345',
        tokenType: 'Bearer',
        expiresIn: 3600
      })

      expect(mockFetch).toHaveBeenCalledWith('https://oauth.example.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: expect.any(URLSearchParams)
      })
    })

    test('sends correct form data in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'my-client-id',
        clientSecret: 'my-client-secret',
        scope: 'deploy read'
      }

      await obtainOAuthToken(config)

      const callArgs = mockFetch.mock.calls[0]
      const body = callArgs[1]?.body as URLSearchParams
      
      expect(body.get('grant_type')).toBe('client_credentials')
      expect(body.get('client_id')).toBe('my-client-id')
      expect(body.get('client_secret')).toBe('my-client-secret')
      expect(body.get('scope')).toBe('deploy read')
    })

    test('masks sensitive credentials in logs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'sensitive-token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'sensitive-client-id',
        clientSecret: 'sensitive-client-secret',
        scope: 'deploy'
      }

      await obtainOAuthToken(config)

      expect(mockedCore.setSecret).toHaveBeenCalledWith('sensitive-client-id')
      expect(mockedCore.setSecret).toHaveBeenCalledWith('sensitive-client-secret')
      expect(mockedCore.setSecret).toHaveBeenCalledWith('sensitive-token')
    })

    test('uses default scope when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret'
        // No scope provided
      }

      await obtainOAuthToken(config)

      const callArgs = mockFetch.mock.calls[0]
      const body = callArgs[1]?.body as URLSearchParams
      expect(body.get('scope')).toBe('deploy')
    })

    test('handles missing token_type in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token-without-type',
          expires_in: 3600
          // No token_type field
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }

      const token = await obtainOAuthToken(config)

      expect(token.tokenType).toBe('Bearer')  // Default value
    })

    test('handles missing expires_in in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token-no-expiry',
          token_type: 'Bearer'
          // No expires_in field
        })
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }

      const token = await obtainOAuthToken(config)

      expect(token.expiresIn).toBe(3600)  // Default 1 hour
    })

    test('throws error on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response)

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'invalid-client',
        clientSecret: 'invalid-secret'
      }

      await expect(obtainOAuthToken(config)).rejects.toThrow(
        'OAuth authentication failed: 401 Unauthorized'
      )
    })

    test('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const config: OAuthConfig = {
        url: 'https://unreachable.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }

      await expect(obtainOAuthToken(config)).rejects.toThrow(
        'OAuth token acquisition failed: Connection refused'
      )
    })

    test('handles unknown error types', async () => {
      mockFetch.mockRejectedValueOnce('String error')

      const config: OAuthConfig = {
        url: 'https://oauth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }

      await expect(obtainOAuthToken(config)).rejects.toThrow(
        'OAuth token acquisition failed: Unknown error'
      )
    })
  })

  describe('cacheOAuthToken', () => {
    test('exports token to environment variables', () => {
      const token: OAuthToken = {
        accessToken: 'cached-token-123',
        tokenType: 'Bearer',
        expiresIn: 7200
      }

      cacheOAuthToken(token)

      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_AUTH_TOKEN', 'cached-token-123')
      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_TOKEN_TYPE', 'Bearer')
      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_TOKEN_EXPIRES', '1704074400000') // 2024-01-01 + 7200s
    })

    test('calculates correct expiration timestamp', () => {
      // Current time is 2024-01-01T00:00:00Z (1704067200000 ms)
      const token: OAuthToken = {
        accessToken: 'token',
        tokenType: 'Bearer',
        expiresIn: 3600  // 1 hour
      }

      cacheOAuthToken(token)

      const expectedExpiry = Date.now() + (3600 * 1000)  // Current time + 1 hour in ms
      expect(mockedCore.exportVariable).toHaveBeenCalledWith('FTL_TOKEN_EXPIRES', expectedExpiry.toString())
    })
  })

  describe('getCachedOAuthToken', () => {
    test('returns cached token when valid and not expired', () => {
      const futureTime = Date.now() + 3600000  // 1 hour from now
      
      process.env.FTL_AUTH_TOKEN = 'cached-token'
      process.env.FTL_TOKEN_TYPE = 'Bearer'
      process.env.FTL_TOKEN_EXPIRES = futureTime.toString()

      const token = getCachedOAuthToken()

      expect(token).toEqual({
        accessToken: 'cached-token',
        tokenType: 'Bearer',
        expiresIn: 3600  // Remaining seconds
      })
    })

    test('returns null when token is missing', () => {
      // No environment variables set
      const token = getCachedOAuthToken()
      expect(token).toBeNull()
    })

    test('returns null when token is expired', () => {
      const pastTime = Date.now() - 1000  // 1 second ago
      
      process.env.FTL_AUTH_TOKEN = 'expired-token'
      process.env.FTL_TOKEN_TYPE = 'Bearer'
      process.env.FTL_TOKEN_EXPIRES = pastTime.toString()

      const token = getCachedOAuthToken()
      expect(token).toBeNull()
    })

    test('returns null when token type is missing', () => {
      const futureTime = Date.now() + 3600000
      
      process.env.FTL_AUTH_TOKEN = 'token'
      // Missing FTL_TOKEN_TYPE
      process.env.FTL_TOKEN_EXPIRES = futureTime.toString()

      const token = getCachedOAuthToken()
      expect(token).toBeNull()
    })

    test('returns null when expiry timestamp is invalid', () => {
      process.env.FTL_AUTH_TOKEN = 'token'
      process.env.FTL_TOKEN_TYPE = 'Bearer'
      process.env.FTL_TOKEN_EXPIRES = 'invalid-timestamp'

      const token = getCachedOAuthToken()
      expect(token).toBeNull()
    })

    test('calculates remaining seconds correctly', () => {
      const futureTime = Date.now() + 7200000  // 2 hours from now
      
      process.env.FTL_AUTH_TOKEN = 'token'
      process.env.FTL_TOKEN_TYPE = 'Bearer'
      process.env.FTL_TOKEN_EXPIRES = futureTime.toString()

      const token = getCachedOAuthToken()

      expect(token?.expiresIn).toBe(7200)  // 2 hours in seconds
    })
  })
})