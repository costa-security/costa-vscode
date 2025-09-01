import type { ExtensionContext } from 'vscode'
import * as crypto from 'node:crypto'
import * as process from 'node:process'
import { commands, env, Uri, window } from 'vscode'
import { getOutputChannel } from './api'
import { API_BASE_URL, OAUTH2_CLIENT_ID, OAUTH2_REDIRECT_URI } from './config'

// Use a more comprehensive logging approach
function debugLog(message: string) {
  console.warn(`[COSTA-OAUTH] ${message}`) // This goes to Debug Console
  try {
    getOutputChannel().appendLine(message) // This goes to Output panel
  }
  catch {
    // Fallback if getOutputChannel is not available during early startup
    console.warn(`[COSTA-FALLBACK] ${message}`)
  }
}

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
        debugLog('Tokens loaded on startup')
        this.printTokensToLogs()
      } else {
        debugLog('No tokens found on startup')
      }
    } catch (error) {
      debugLog(`Error loading tokens on startup: ${error}`)
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
      debugLog(`Generated Code Verifier: ${this.codeVerifier}`)
      debugLog(`Generated Code Challenge: ${codeChallenge}`)

      // Create state parameter for security
      const state = crypto.randomBytes(16).toString('hex')
      debugLog(`Generated State: ${state}`)

      // Store state in global state for verification later
      if (this.context) {
        this.context.globalState.update('costa.oauth2.state', state)
      }

      // Determine API base URL (use environment variable in development)
      const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'

      // Get OAuth2 configuration
      const clientId = OAUTH2_CLIENT_ID
      const redirectUri = OAUTH2_REDIRECT_URI

      debugLog(`API Base URL: ${apiBaseUrl}`)
      debugLog(`Client ID: ${clientId}`)
      debugLog(`Redirect URI: ${redirectUri}`)

      // Check if values are undefined and show error
      if (!clientId || !redirectUri) {
        debugLog('ERROR: OAuth2 configuration values are undefined!')
        debugLog(`Client ID is: ${clientId} (type: ${typeof clientId})`)
        debugLog(`Redirect URI is: ${redirectUri} (type: ${typeof redirectUri})`)
        window.showErrorMessage('OAuth2 configuration error: clientId or redirectUri is undefined')
        return false
      }

      const authUrl = new URL(`${apiBaseUrl}/oauth/authorize`)
      authUrl.searchParams.append('client_id', clientId)
      authUrl.searchParams.append('redirect_uri', redirectUri)
      authUrl.searchParams.append('response_type', 'code')
      authUrl.searchParams.append('scope', 'openid profile email usage_information offline_access view_notifications')
      authUrl.searchParams.append('state', state)
      authUrl.searchParams.append('code_challenge', codeChallenge)
      authUrl.searchParams.append('code_challenge_method', 'S256')

      // Open browser to start authentication
      const uri = Uri.parse(authUrl.toString())
      await env.openExternal(uri)

      getOutputChannel().appendLine(`Opened browser for OAuth2 authentication: ${authUrl.toString()}`)
      debugLog(`Full Authorization URL: ${authUrl.toString()}`)
      window.showInformationMessage('Opened browser for Costa authentication. Please complete the login process.')

      // Set up a promise that will be resolved when we receive the callback
      return new Promise<boolean>((resolve, reject) => {
        this.pendingLogin = { resolve, reject }

        // Register a disposable to handle the callback
        const disposable = commands.registerCommand('costa.handleOAuthCallback', async (uri: Uri) => {
          debugLog(`Received OAuth callback: ${uri.toString()}`)
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
              debugLog(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            if (!code) {
              const errorMessage = 'OAuth2 authentication failed: No authorization code received'
              debugLog(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            debugLog(`Received Authorization Code: ${code}`)

            // Verify state parameter
            const storedState = this.context?.globalState.get<string>('costa.oauth2.state')
            debugLog(`Stored State: ${storedState}`)
            debugLog(`Received State: ${receivedState}`)

            if (storedState !== receivedState) {
              const errorMessage = 'OAuth2 authentication failed: Invalid state parameter'
              debugLog(errorMessage)
              window.showErrorMessage(errorMessage)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
              return
            }

            // Exchange the authorization code for an access token
            try {
              debugLog(`Exchanging code for token with Code Verifier: ${this.codeVerifier}`)
              const tokenResponse = await this.exchangeCodeForToken(code, this.codeVerifier!)

              // Display the token in a dialog (as requested)
              window.showInformationMessage(`Your access token is: ${tokenResponse.access_token}`, { modal: true, detail: 'This is your OAuth2 access token. Keep it secure.' })

              // Save the token
              this.token = {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in, // Add expires_in to current time
                token_type: tokenResponse.token_type,
              }
              await this.saveToken()
              getOutputChannel().appendLine('OAuth2 login successful')
              window.showInformationMessage('Successfully logged in to Costa')

              this.pendingLogin?.resolve(true)
              this.pendingLogin = null
            }
            catch (error) {
              getOutputChannel().appendLine(`OAuth2 token exchange error: ${error}`)
              window.showErrorMessage(`OAuth2 token exchange failed: ${error}`)
              this.pendingLogin?.resolve(false)
              this.pendingLogin = null
            }
          }
          catch (error) {
            getOutputChannel().appendLine(`OAuth2 callback error: ${error}`)
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
      getOutputChannel().appendLine(`OAuth2 login error: ${error}`)
      window.showErrorMessage(`OAuth2 login failed: ${error}`)
      return false
    }
  }

  // Method to handle OAuth callback from URI handler
  handleCallback(uri: Uri): void {
    debugLog(`handleCallback called with URI: ${uri.toString()}`)
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
      // Token expired, try to refresh if we have a refresh token
      if (this.token.refresh_token) {
        debugLog('Token expired, attempting to refresh')
        try {
          const newToken = await this.refreshAccessToken(this.token.refresh_token)
          this.token = newToken
          await this.saveToken()
          return this.token.access_token
        } catch (error) {
          debugLog(`Failed to refresh token: ${error}, clearing stored tokens`)
          await this.clearToken()
          this.token = null
          return null
        }
      } else {
        // No refresh token, clear stored tokens
        debugLog('Token expired and no refresh token available, clearing stored tokens')
        await this.clearToken()
        this.token = null
        return null
      }
    }

    return this.token.access_token
  }

  isLoggedIn(): boolean {
    return !!this.token?.access_token
  }

  // Method to print current tokens to logs for testing
  printTokensToLogs(): void {
    if (this.token) {
      debugLog(`Current Access Token: ${this.token.access_token}`)
      debugLog(`Current Refresh Token: ${this.token.refresh_token || 'N/A'}`)
      debugLog(`Token Expires At: ${this.token.expires_at || 'N/A'}`)
      debugLog(`Token Type: ${this.token.token_type || 'N/A'}`)
    }
    else {
      debugLog('No tokens currently stored')
    }
  }

  async logout() {
    this.token = null
    this.codeVerifier = null
    await this.clearToken()
    getOutputChannel().appendLine('OAuth2 logout successful')
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
      getOutputChannel().appendLine(`Error loading token: ${error}`)
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

    getOutputChannel().appendLine(`Refreshing token at: ${tokenUrl.toString()}`)

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
        getOutputChannel().appendLine(`Token refresh failed with status ${response.status}: ${errorText}`)
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const tokenResponse: any = await response.json()
      getOutputChannel().appendLine(`Token refresh successful`)
      getOutputChannel().appendLine(`New Access Token: ${tokenResponse.access_token}`)
      getOutputChannel().appendLine(`New Refresh Token: ${tokenResponse.refresh_token || 'N/A'}`)

      return {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
        token_type: tokenResponse.token_type,
      }
    } catch (error) {
      getOutputChannel().appendLine(`Error during token refresh: ${error}`)
      throw error
    }
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    // Determine API base URL (use environment variable in development)
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'

    // Get OAuth2 configuration
    const clientId = OAUTH2_CLIENT_ID
    const redirectUri = OAUTH2_REDIRECT_URI

    getOutputChannel().appendLine(`exchangeCodeForToken - Client ID: ${clientId}`)
    getOutputChannel().appendLine(`exchangeCodeForToken - Redirect URI: ${redirectUri}`)

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

    getOutputChannel().appendLine(`Exchanging code for token at: ${tokenUrl.toString()}`)
    getOutputChannel().appendLine(`Token request params: ${params.toString()}`)

    // Log the curl command for testing
    const curlCommand = `curl -X POST "${tokenUrl.toString()}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "client_id=${clientId}" \\
  -d "code=${code}" \\
  -d "redirect_uri=${redirectUri}" \\
  -d "code_verifier=${codeVerifier}"`

    debugLog(`CURL command for testing token exchange:`)
    debugLog(curlCommand)

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
        getOutputChannel().appendLine(`Token exchange failed with status ${response.status}: ${errorText}`)
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const tokenResponse: any = await response.json()
      getOutputChannel().appendLine(`Token exchange successful`)
      getOutputChannel().appendLine(`Access Token: ${tokenResponse.access_token}`)
      getOutputChannel().appendLine(`Refresh Token: ${tokenResponse.refresh_token || 'N/A'}`)

      return {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_in: tokenResponse.expires_in,
        token_type: tokenResponse.token_type,
      }
    }
    catch (error) {
      getOutputChannel().appendLine(`Error during token exchange: ${error}`)
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

// Add startup logging to verify logging is working
debugLog('OAuth2 client initialized')
