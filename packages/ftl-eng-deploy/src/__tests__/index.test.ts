import { run } from '../index'
import * as core from '@actions/core'
import { obtainOAuthToken, cacheOAuthToken, getCachedOAuthToken, type OAuthToken } from '@fastertools/shared'

// Mock external dependencies
jest.mock('@actions/core')
jest.mock('@fastertools/shared')

const mockedCore = core as jest.Mocked<typeof core>
const mockedObtainOAuthToken = obtainOAuthToken as jest.MockedFunction<typeof obtainOAuthToken>
const mockedCacheOAuthToken = cacheOAuthToken as jest.MockedFunction<typeof cacheOAuthToken>
const mockedGetCachedOAuthToken = getCachedOAuthToken as jest.MockedFunction<typeof getCachedOAuthToken>

describe('FTL Engineering Deploy Action', () => {
  let mockFetch: jest.MockedFunction<typeof global.fetch>
  
  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>
    global.fetch = mockFetch
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Mock default successful OAuth token
    const mockToken: OAuthToken = {
      accessToken: 'test-token-123',
      tokenType: 'Bearer',
      expiresIn: 3600
    }
    mockedObtainOAuthToken.mockResolvedValue(mockToken)
    mockedGetCachedOAuthToken.mockReturnValue(null)  // No cached token by default
    
    // Mock successful deployment API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        deployment_id: 'deploy-456',
        status: 'pending',
        url: 'https://app.ftl.dev/deployments/deploy-456'
      })
    } as Response)
    
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('Authentication Flow', () => {
    test('uses cached OAuth token when available', async () => {
      const cachedToken: OAuthToken = {
        accessToken: 'cached-token-789',
        tokenType: 'Bearer',
        expiresIn: 1800
      }
      mockedGetCachedOAuthToken.mockReturnValue(cachedToken)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'staging'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedObtainOAuthToken).not.toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer cached-token-789'
          })
        })
      )
    })

    test('obtains new OAuth token with client credentials when no cached token', async () => {
      mockedGetCachedOAuthToken.mockReturnValue(null)  // No cached token
      
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'production',
          'client-id': 'test-client-id',
          'client-secret': 'test-client-secret'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedObtainOAuthToken).toHaveBeenCalledWith({
        url: 'https://api.ftl.dev/oauth/token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        scope: 'deploy'
      })
      expect(mockedCacheOAuthToken).toHaveBeenCalledWith({
        accessToken: 'test-token-123',
        tokenType: 'Bearer',
        expiresIn: 3600
      })
    })

    test('uses custom OAuth URL from environment', async () => {
      process.env.FTL_OAUTH_URL = 'https://custom-oauth.example.com/token'
      
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'client-id': 'client-id',
          'client-secret': 'client-secret'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedObtainOAuthToken).toHaveBeenCalledWith({
        url: 'https://custom-oauth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'deploy'
      })

      delete process.env.FTL_OAUTH_URL
    })

    test('fails when no authentication method available', async () => {
      mockedGetCachedOAuthToken.mockReturnValue(null)  // No cached token
      
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project'
          // No client-id or client-secret
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Authentication required. Provide client-id/client-secret or use authenticate-ftl action first.'
      )
    })

    test('handles OAuth token acquisition failure', async () => {
      mockedGetCachedOAuthToken.mockReturnValue(null)
      mockedObtainOAuthToken.mockRejectedValueOnce(new Error('Invalid client credentials'))

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'client-id': 'invalid-client',
          'client-secret': 'invalid-secret'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Authentication failed: Invalid client credentials'
      )
    })
  })

  describe('Deployment Execution', () => {
    beforeEach(() => {
      // Setup default auth
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'staging',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
        }
        return inputs[name] || ''
      })
    })

    test('executes deployment with correct API call', async () => {
      await run()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ftl.dev/projects/test-project/environments/staging/deploy',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            project: 'test-project',
            environment: 'staging'
          })
        }
      )
    })

    test('includes custom deployment parameters when provided', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'production',
          'client-id': 'test-client',
          'client-secret': 'test-secret',
          'timeout': '600',
          'config-file': './ftl.toml'
        }
        return inputs[name] || ''
      })

      await run()

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1]?.body as string)
      
      expect(requestBody).toEqual({
        project: 'test-project',
        environment: 'production',
        timeout: 600,
        configFile: './ftl.toml'
      })
    })

    test('handles deployment API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: 'Invalid project configuration'
        })
      } as Response)

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Deployment failed: 400 Bad Request - Invalid project configuration'
      )
    })

    test('handles network errors during deployment', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Deployment request failed: Network timeout'
      )
    })

    test('uses custom API endpoint when provided', async () => {
      process.env.FTL_API_URL = 'https://custom-api.example.com'

      await run()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-api.example.com/projects/test-project/environments/staging/deploy',
        expect.any(Object)
      )

      delete process.env.FTL_API_URL
    })
  })

  describe('Wait for Completion', () => {
    beforeEach(() => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'staging',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
        }
        return inputs[name] || ''
      })
    })

    test('waits for deployment completion when wait-for-completion is true', async () => {
      mockedCore.getBooleanInput.mockImplementation((name: string) => {
        return name === 'wait-for-completion'
      })

      // Mock initial deployment response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          deployment_id: 'deploy-123',
          status: 'in_progress',
          url: 'https://app.ftl.dev/deployments/deploy-123'
        })
      } as Response)

      // Mock status check responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          deployment_id: 'deploy-123',
          status: 'in_progress'
        })
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          deployment_id: 'deploy-123',
          status: 'completed',
          url: 'https://app.ftl.dev/deployments/deploy-123'
        })
      } as Response)

      const promise = run()
      jest.runAllTimers()
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(3)  // Deploy + 2 status checks
      expect(mockedCore.setOutput).toHaveBeenCalledWith('status', 'completed')
    })

    test('polls deployment status with correct interval', async () => {
      mockedCore.getBooleanInput.mockReturnValue(true)  // wait-for-completion

      // Mock in_progress responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deployment_id: 'deploy-123', status: 'in_progress' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deployment_id: 'deploy-123', status: 'in_progress' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deployment_id: 'deploy-123', status: 'completed' })
        } as Response)

      const promise = run()
      
      // Fast forward through polling intervals
      jest.advanceTimersByTime(30000)  // 30 seconds
      jest.runAllTimers()
      await promise

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    test('times out when deployment takes too long', async () => {
      mockedCore.getBooleanInput.mockReturnValue(true)  // wait-for-completion
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'staging',
          'client-id': 'test-client',
          'client-secret': 'test-secret',
          'deployment-timeout': '60'  // 1 minute timeout
        }
        return inputs[name] || ''
      })

      // Mock deployment that never completes
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deployment_id: 'deploy-123', status: 'in_progress' })
      } as Response)

      const promise = run()
      jest.advanceTimersByTime(61000)  // Just over 1 minute
      jest.runAllTimers()

      await promise

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Deployment timed out after 60 seconds'
      )
    })

    test('handles deployment failure status', async () => {
      mockedCore.getBooleanInput.mockReturnValue(true)  // wait-for-completion

      // Mock failed deployment
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deployment_id: 'deploy-123', status: 'in_progress' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            deployment_id: 'deploy-123',
            status: 'failed',
            error: 'Build compilation failed'
          })
        } as Response)

      const promise = run()
      jest.runAllTimers()
      await promise

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Deployment failed: Build compilation failed'
      )
    })

    test('skips waiting when wait-for-completion is false', async () => {
      mockedCore.getBooleanInput.mockReturnValue(false)  // wait-for-completion = false

      await run()

      expect(mockFetch).toHaveBeenCalledTimes(1)  // Only initial deployment call
      expect(mockedCore.setOutput).toHaveBeenCalledWith('status', 'pending')
    })
  })

  describe('Input Validation', () => {
    test('validates required project input', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        // Missing required project
        return name === 'project' ? '' : 'some-value'
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Project name is required'
      )
    })

    test('uses default environment when not specified', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
          // No environment specified
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.ftl.dev/projects/test-project/environments/staging/deploy',  // Default to staging
        expect.any(Object)
      )
    })

    test('validates deployment timeout input', async () => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'client-id': 'test-client',
          'client-secret': 'test-secret',
          'deployment-timeout': 'invalid-number'
        }
        return inputs[name] || ''
      })

      await run()

      // Should use default timeout despite invalid input
      expect(mockedCore.warning).toHaveBeenCalledWith(
        'Invalid deployment-timeout value, using default (300 seconds)'
      )
    })
  })

  describe('Output Generation', () => {
    beforeEach(() => {
      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'environment': 'production',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
        }
        return inputs[name] || ''
      })
    })

    test('sets all required outputs on successful deployment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          deployment_id: 'deploy-abc123',
          status: 'completed',
          url: 'https://app.ftl.dev/deployments/deploy-abc123'
        })
      } as Response)

      await run()

      expect(mockedCore.setOutput).toHaveBeenCalledWith('deployment-id', 'deploy-abc123')
      expect(mockedCore.setOutput).toHaveBeenCalledWith('deployment-url', 'https://app.ftl.dev/deployments/deploy-abc123')
      expect(mockedCore.setOutput).toHaveBeenCalledWith('status', 'completed')
    })

    test('generates deployment summary', async () => {
      await run()

      expect(mockedCore.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Deployment pending')
      )
    })
  })

  describe('Error Handling', () => {
    test('provides actionable error for invalid project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({
          error: 'Project not found'
        })
      } as Response)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'non-existent-project',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        'Deployment failed: 404 Not Found - Project not found'
      )
    })

    test('handles malformed API responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      } as Response)

      mockedCore.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'project': 'test-project',
          'client-id': 'test-client',
          'client-secret': 'test-secret'
        }
        return inputs[name] || ''
      })

      await run()

      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse deployment response')
      )
    })
  })
})