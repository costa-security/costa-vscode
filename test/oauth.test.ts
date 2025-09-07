import type { ExtensionContext } from 'vscode'
import type { OAuthToken } from '../src/oauth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { oauth2Client } from '../src/oauth'

// Mock VS Code modules
const mockGlobalState = {
  get: vi.fn(),
  update: vi.fn(),
}

const mockSecrets = {
  get: vi.fn(),
  store: vi.fn(),
  delete: vi.fn(),
}

const mockContext: any = {
  globalState: mockGlobalState,
  secrets: mockSecrets,
  subscriptions: [],
}

describe('oAuth2 Client', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()

    // Reset the oauth2Client state
    ;(oauth2Client as any).token = null
    ;(oauth2Client as any).context = null
    ;(oauth2Client as any).codeVerifier = null
    ;(oauth2Client as any).pendingLogin = null

    // Set the mock context
    oauth2Client.setContext(mockContext)
  })

  afterEach(() => {
    // Clean up after each test
    vi.clearAllMocks()
  })

  // describe('token Storage', () => {
  //   it('should save token to global state', async () => {
  //     const token: OAuthToken = {
  //       access_token: 'test-access-token',
  //       refresh_token: 'test-refresh-token',
  //       expires_at: Math.floor(Date.now() / 1000) + 3600,
  //       token_type: 'bearer',
  //     }

  //     // Set the token directly
  //     ;(oauth2Client as any).token = token

  //     // Call saveToken
  //     ;(oauth2Client as any).saveToken()

  //     // Verify that update was called with correct parameters
  //     expect(mockGlobalState.update).toHaveBeenCalledWith(
  //       'costa.oauth2.token',
  //       JSON.stringify(token),
  //     )
  //   })

  //   it('should load token from global state', async () => {
  //     const token: OAuthToken = {
  //       access_token: 'test-access-token',
  //       refresh_token: 'test-refresh-token',
  //       expires_at: Math.floor(Date.now() / 1000) + 3600,
  //       token_type: 'bearer',
  //     }

  //     // Mock the globalState.get to return our token
  //     mockGlobalState.get.mockReturnValue(JSON.stringify(token))

  //     // Call loadToken
  //     const loadedToken = (oauth2Client as any).loadToken()

  //     // Verify that get was called with correct parameter
  //     expect(mockGlobalState.get).toHaveBeenCalledWith('costa.oauth2.token')

  //     // Verify that the token was loaded correctly
  //     expect(loadedToken).toEqual(token)
  //   })

  //   it('should handle null token when loading', async () => {
  //     // Mock the globalState.get to return null
  //     mockGlobalState.get.mockReturnValue(null)

  //     // Call loadToken
  //     const loadedToken = (oauth2Client as any).loadToken()

  //     // Verify that null is returned
  //     expect(loadedToken).toBeNull()
  //   })

  //   it('should handle invalid JSON when loading token', async () => {
  //     // Mock the globalState.get to return invalid JSON
  //     mockGlobalState.get.mockReturnValue('invalid-json')

  //     // Call loadToken
  //     const loadedToken = (oauth2Client as any).loadToken()

  //     // Verify that null is returned due to JSON parsing error
  //     expect(loadedToken).toBeNull()
  //   })

  //   it('should clear token from global state on logout', async () => {
  //     // Call clearToken
  //     ;(oauth2Client as any).clearToken()

  //     // Verify that update was called with undefined to clear the token
  //     expect(mockGlobalState.update).toHaveBeenCalledWith(
  //       'costa.oauth2.token',
  //       undefined,
  //     )

  //     // Also check that state is cleared
  //     expect(mockGlobalState.update).toHaveBeenCalledWith(
  //       'costa.oauth2.state',
  //       undefined,
  //     )
  //   })
  // })

  describe('token Management', () => {
    it('should return null access token when not logged in', async () => {
      mockGlobalState.get.mockReturnValue(null)

      const accessToken = await oauth2Client.getAccessToken()

      expect(accessToken).toBeNull()
    })

    it('should return access token when logged in', async () => {
      const token: OAuthToken = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
      }

      const mockContext = {
        secrets: {
          get: vi.fn().mockResolvedValue(JSON.stringify(token)),
          store: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        },
        globalState: {
          get: vi.fn(),
          update: vi.fn().mockResolvedValue(undefined),
        },
        subscriptions: [] as any[],
      } as unknown as ExtensionContext

      ;(oauth2Client as any).context = mockContext

      const accessToken = await oauth2Client.getAccessToken()
      expect(accessToken).toBe('test-access-token')
    })

    it('should return null when token is expired', async () => {
      const expiredToken: OAuthToken = {
        access_token: 'expired-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        token_type: 'bearer',
      }

      mockGlobalState.get.mockReturnValue(JSON.stringify(expiredToken))

      const accessToken = await oauth2Client.getAccessToken()

      expect(accessToken).toBeNull()
    })

    it('should detect if user is logged in', () => {
      // Should return false when no token
      expect(oauth2Client.isLoggedIn()).toBe(false)

      // Set a token and check again
      const token: OAuthToken = {
        access_token: 'test-access-token',
      }
      ;(oauth2Client as any).token = token

      expect(oauth2Client.isLoggedIn()).toBe(true)
    })
  })

  // describe('print Tokens', () => {
  //   it('should print tokens to logs when tokens exist', () => {
  //     const token: OAuthToken = {
  //       access_token: 'test-access-token',
  //       refresh_token: 'test-refresh-token',
  //       expires_at: Math.floor(Date.now() / 1000) + 3600,
  //       token_type: 'bearer',
  //     }

  //     ;(oauth2Client as any).token = token

  //     // Mock console.warn to capture log output
  //     const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  //     oauth2Client.printTokensToLogs()

  //     // Verify that console.warn was called with token information
  //     expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current Access Token: test-access-token'))
  //     expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current Refresh Token: test-refresh-token'))

  //     // Restore console
  //     consoleSpy.mockRestore()
  //   })

  //   it('should print "No tokens currently stored" when no tokens exist', () => {
  //     ;(oauth2Client as any).token = null

  //     // Mock console.warn to capture log output
  //     const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  //     oauth2Client.printTokensToLogs()

  //     // Verify that console.warn was called with the correct message
  //     expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No tokens currently stored'))

  //     // Restore console
  //     consoleSpy.mockRestore()
  //   })
  // })
})
