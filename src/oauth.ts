import * as time from './utils/time'
import type { ExtensionContext } from 'vscode'
import * as crypto from 'node:crypto'
import * as process from 'node:process'
import { log } from './utils/logger'
import { commands, env, Uri, window } from 'vscode'
import { API_BASE_URL, OAUTH2_CLIENT_ID, OAUTH2_REDIRECT_URI } from './config'

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  import('dotenv').then((dotenv) => {
    dotenv.config()
  }).catch(() => {
    // dotenv not available, skip
  })
}

// Token storage interface
export interface OAuthToken {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type?: string
}

// Token response interface
interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// Simple OAuth2 client implementation with PKCE
class OAuth2Client {
  private token: OAuthToken | null = null
  private context: ExtensionContext | null = null
  private codeVerifier: string | null = null
  private pendingLogin: { resolve: (value: boolean) => void, reject: (reason: any) => void } | null = null

  setContext(context: ExtensionContext) {
    this.context = context
    // Load tokens on startup
    this.loadAndPrintTokensOnStartup()
  }

  // Load and print tokens on startup for debugging
  private async loadAndPrintTokensOnStartup() {
    try {
      const token = await this.loadToken()
      if (token) {
        this.token = token
        log.info('Tokens loaded on startup')
        this.printTokensToLogs()
      } else {
        log.info('No tokens found on startup')
      }
    } catch (error) {
      log.info(`Error loading tokens on startup: ${error}`)
    }
  }

  // Generate a code verifier for PKCE
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  // Generate a code challenge from the code verifier
  private generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    return hash
  }

  async login(): Promise<boolean> {
    try {
      // Check if already logged in
      if (this.isLoggedIn()) {
        window.showInformationMessage('Already logged in to Costa')
        return true
      }

      // Generate PKCE codes
      this.codeVerifier = this.generateCodeVerifier()
      const codeChallenge = this.generateCodeChallenge(this.codeVerifier)

      // Log PKCE values for debugging/testing
      log.info(`Generated Code Verifier: ${this.codeVerifier}`)
      log.info(`Generated Code Challenge: ${codeChallenge}`)

      // Create state parameter for security
      const state = crypto.randomBytes(16).toString('hex')
      log.info(`Generated State: ${state}`)

      // Store state in global state for verification later
      if (this.context) {
        this.context.globalState.update('costa.oauth2.state', state)
      }

      // Determine API base URL (use environment variable in development)
      const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'

      // Get OAuth2 configuration
      const clientId = OAUTH2_CLIENT_ID
      const redirectUri = OAUTH2_REDIRECT_URI

      log.info(`API Base URL: ${apiBaseUrl}`)
      log.info(`Client ID: ${clientId}`)
      log.info(`Redirect URI: ${redirectUri}`)

      // Check if values are undefined and show error
      if (!clientId || !redirectUri) {
        log.info('ERROR: OAuth2 configuration values are undefined!')
        log.info(`Client ID is: ${clientId} (type: ${typeof clientId})`)
        log.info(`Redirect URI is: ${redirectUri} (type: ${typeof redirectUri})`)
        window.showErrorMessage('OAuth2 configuration error: clientId or redirectUri is undefined')
        return false
      }

      const authUrl = new URL(`${apiBaseUrl}/oauth/authorize`)
      authUrl.searchParams.append('client_id', clientId)
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('scope', 'openid profile email usage offline_access notifications')
      authUrl.searchParams.append('state', state)
      authUrl.searchParams.append('code_challenge', codeChallenge)
      authUrl.searchParams.append('code_challenge_method', 'S256')

      // Open browser to start authentication
      const uri = Uri.parse(authUrl.toString())
      await env.openExternal(uri)

      log.info(`Opened browser for OAuth2 authentication: ${authUrl.toString()}`)
      log.info(`Full Authorization URL: ${authUrl.toString()}`)
      window.showInformationMessage('Opened browser for Costa authentication. Please complete the login process.')

      // Set up a promise that will be resolved when we receive the callback
      return new Promise<boolean>((resolve, reject) => {
        this.pendingLogin = { resolve, reject }

        // Register a disposable to handle the callback
        const disposable = commands.registerCommand('costa.handleOAuthCallback', async (uri: Uri) => {
          log.info(`Received OAuth callback: ${uri.toString()}`)
          try {
            // Parse the callback URL
            const query = new URLSearchParams(uri.query)
            const code = query.get('code')
            const receivedState = query.get('state')
            const error = query.get('error')

            // Clean up the disposable
            disposable.dispose()

            if (error) {
              const errorMessage = `OAuth2 authentication failed: ${error}`
              log.info(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            if (!code) {
              const errorMessage = 'OAuth2 authentication failed: No authorization code received'
              log.info(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            log.info(`Received Authorization Code: ${code}`)

            // Verify state parameter
            const storedState = this.context?.globalState.get<string>('costa.oauth2.state')
            log.info(`Stored State: ${storedState}`)
            log.info(`Received State: ${receivedState}`)

            if (storedState !== receivedState) {
              const errorMessage = 'OAuth2 authentication failed: Invalid state parameter'
              log.info(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            // Exchange the authorization code for an access token
            try {
              log.info(`Exchanging code for token with Code Verifier: ${this.codeVerifier}`)
              const tokenResponse = await this.exchangeCodeForToken(code, this.codeVerifier!)

              // Save the token
              this.token = {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in, // Add expires_in to current time
                token_type: tokenResponse.token_type,
              }
              await this.saveToken()
              log.info('OAuth2 login successful')
              window.showInformationMessage('Successfully logged in to Costa')

              this.pendingLogin?.resolve(true)
              this.pendingLogin = null
            }
            catch (error) {
              log.info(`OAuth2 token exchange error: ${error}`)
              window.showErrorMessage(`OAuth2 token exchange failed: ${error}`)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
            }
          }
          catch (error) {
            log.info(`OAuth2 callback error: ${error}`)
            window.showErrorMessage(`OAuth2 callback failed: ${error}`)
            disposable.dispose()
            this.pendingLogin?.resolve(false)
            this.pendingLogin = null
          }
        })

        // Register the command
        this.context?.subscriptions.push(disposable)

        // Show a message to the user
        window.showInformationMessage('Please complete authentication in your browser. You will be redirected back to VS Code automatically.')
      })
    }
    catch (error) {
      log.info(`OAuth2 login error: ${error}`)
      window.showErrorMessage(`OAuth2 login failed: ${error}`)
      return false
    }
  }

  // Method to handle OAuth callback from URI handler
  handleCallback(uri: Uri): void {
    commands.executeCommand('costa.handleOAuthCallback', uri)
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.token) {
      const storedToken = await this.loadToken()
      if (storedToken) {
        this.token = storedToken
      }
    }

    if (!this.token) {
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    if (this.token.expires_at && Date.now() / 1000 > this.token.expires_at - 300) {
      return this.refreshTokenIfNeeded()
    }

    return this.token.access_token
  }

  /**
   * Force refresh the access token
   */
  async forceRefreshToken(): Promise<string | null> {
    if (!this.token || !this.token.refresh_token) {
      return null
    }

    try {
      const newToken = await this.refreshAccessToken(this.token.refresh_token)
      this.token = newToken
      await this.saveToken()
      return this.token.access_token
    } catch (error) {
      log.info(`Failed to force refresh token: ${error}, clearing stored tokens`)
      await this.clearToken()
      this.token = null
      return null
    }
  }

  /**
   * Refresh token if needed
   */
  private async refreshTokenIfNeeded(): Promise<string | null> {
    // Token expired, try to refresh if we have a refresh token
    if (this.token?.refresh_token) {
      log.info('Token expired, attempting to refresh')
      try {
        const newToken = await this.refreshAccessToken(this.token.refresh_token)
        this.token = newToken
        await this.saveToken()
        return this.token.access_token
      } catch (error) {
        log.info(`Failed to refresh token: ${error}, clearing stored tokens`)
        await this.clearToken()
        this.token = null
        return null
      }
    } else {
      // No refresh token, clear stored tokens
      log.info('Token expired and no refresh token available, clearing stored tokens')
      await this.clearToken()
      this.token = null
      return null
    }
  }

  isLoggedIn(): boolean {
    console.log('hello world form isLoggedIn')
    console.log('this.token is '+ this.token)
    return !!this.token?.access_token
  }

  // Method to print current tokens to logs for testing
  printTokensToLogs(): void {
    if (this.token) {
      log.info(`Current Access Token: ${this.token.access_token}`)
      log.info(`Current Refresh Token: ${this.token.refresh_token || 'N/A'}`)
      log.info(`Token Expires At: ${time.formatExpiryLine(this.token.expires_at)}`)
      log.info(`Token Type: ${this.token.token_type || 'N/A'}`)
    }
    else {
      log.info('No tokens currently stored')
    }
  }

  async logout() {
    this.token = null
    this.codeVerifier = null
    await this.clearToken()
    log.info('OAuth2 logout successful')
    window.showInformationMessage('Logged out from Costa')
  }

  private async loadToken(): Promise<OAuthToken | null> {
    try {
      if (!this.context) {
        return null
      }
      const tokenStr = await this.context.secrets.get('costa.oauth2.token')
      return tokenStr ? JSON.parse(tokenStr) : null
    }
    catch (error) {
      log.info(`Error loading token: ${error}`)
      return null
    }
  }

  private async saveToken() {
    if (this.token && this.context) {
      await this.context.secrets.store('costa.oauth2.token', JSON.stringify(this.token))
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<OAuthToken> {
    // Determine API base URL (use environment variable in development)
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'

    // Get OAuth2 configuration
    const clientId = OAUTH2_CLIENT_ID
    const redirectUri = OAUTH2_REDIRECT_URI

    const tokenUrl = new URL(`${apiBaseUrl}/oauth/token`)

    if (!clientId || !redirectUri) {
      throw new Error('OAuth2 configuration error: clientId or redirectUri is undefined')
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
    })

    log.info(`Refreshing token at: ${tokenUrl.toString()}`)

    // Make actual HTTP request to refresh the token
    try {
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.info(`Token refresh failed with status ${response.status}: ${errorText}`)
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const tokenResponse: any = await response.json()
      log.info(`Token refresh successful`)
      log.info(`New Access Token: ${tokenResponse.access_token}`)
      log.info(`New Refresh Token: ${tokenResponse.refresh_token || 'N/A'}`)

      return {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
        token_type: tokenResponse.token_type,
      }
    } catch (error) {
      log.info(`Error during token refresh: ${error}`)
      throw error
    }
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    // Determine API base URL (use environment variable in development)
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'

    // Get OAuth2 configuration
    const clientId = OAUTH2_CLIENT_ID
    const redirectUri = OAUTH2_REDIRECT_URI

    log.info(`exchangeCodeForToken - Client ID: ${clientId}`)
    log.info(`exchangeCodeForToken - Redirect URI: ${redirectUri}`)

    const tokenUrl = new URL(`${apiBaseUrl}/oauth/token`)

    if (!clientId || !redirectUri) {
      throw new Error('OAuth2 configuration error: clientId or redirectUri is undefined')
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    })

    log.info(`Exchanging code for token at: ${tokenUrl.toString()}`)
    log.info(`Token request params: ${params.toString()}`)

    // Log the curl command for testing
    const curlCommand = `curl -X POST "${tokenUrl.toString()}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "client_id=${clientId}" \\
  -d "code=${code}" \\
  -d "redirect_uri=${redirectUri}" \\
  -d "code_verifier=${codeVerifier}"`

    log.info(`CURL command for testing token exchange:`)
    log.info(curlCommand)

    // Make actual HTTP request to exchange the code for tokens
    try {
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.info(`Token exchange failed with status ${response.status}: ${errorText}`)
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const tokenResponse: any = await response.json()
      log.info(`Token exchange successful`)
      log.info(`Access Token: ${tokenResponse.access_token}`)
      log.info(`Refresh Token: ${tokenResponse.refresh_token || 'N/A'}`)

      return {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_in: tokenResponse.expires_in,
        token_type: tokenResponse.token_type,
      }
    }
    catch (error) {
      log.info(`Error during token exchange: ${error}`)
      throw error
    }
  }

  private async clearToken() {
    if (this.context) {
      await this.context.secrets.delete('costa.oauth2.token')
      await this.context.globalState.update('costa.oauth2.state', undefined)
    }
  }
}

// Export singleton instance
export const oauth2Client = new OAuth2Client()
