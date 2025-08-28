import type { ExtensionContext } from 'vscode'
import * as crypto from 'node:crypto'
import * as process from 'node:process'
import { env, Uri, window, commands } from 'vscode'
import { getOutputChannel } from './api'
import { config } from './config'

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

// Simple OAuth2 client implementation with PKCE
class OAuth2Client {
  private token: OAuthToken | null = null
  private context: ExtensionContext | null = null
  private codeVerifier: string | null = null
  private pendingLogin: { resolve: (value: boolean) => void; reject: (reason: any) => void } | null = null

  setContext(context: ExtensionContext) {
    this.context = context
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
      const apiBaseUrl = process.env.COSTA_API_BASE_URL || config.apiBaseUrl || 'https://ai.costa.app'

      // Get OAuth2 configuration
      const clientId = config.oauth2.clientId
      const redirectUri = config.oauth2.redirectUri

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
        this.pendingLogin = { resolve, reject };

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
              window.showInformationMessage(`Your access token is: ${tokenResponse.access_token}`,
                { modal: true, detail: 'This is your OAuth2 access token. Keep it secure.' });

              // Save the token
              this.token = {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in, // Add expires_in to current time
                token_type: tokenResponse.token_type,
              }
              this.saveToken()
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
      });
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
    commands.executeCommand('costa.handleOAuthCallback', uri);
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.token) {
      const storedToken = this.loadToken()
      if (storedToken) {
        this.token = storedToken
      }
    }

    if (!this.token) {
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    if (this.token.expires_at && Date.now() / 1000 > this.token.expires_at - 300) {
      // Token expired, try to refresh or re-login
      return null
    }

    return this.token.access_token
  }

  isLoggedIn(): boolean {
    return !!this.token?.access_token
  }

  logout() {
    this.token = null
    this.codeVerifier = null
    this.clearToken()
    getOutputChannel().appendLine('OAuth2 logout successful')
    window.showInformationMessage('Logged out from Costa')
  }

  private loadToken(): OAuthToken | null {
    try {
      if (!this.context) {
        return null
      }
      const tokenStr = this.context.globalState.get<string>('costa.oauth2.token')
      return tokenStr ? JSON.parse(tokenStr) : null
    }
    catch (error) {
      getOutputChannel().appendLine(`Error loading token: ${error}`)
      return null
    }
  }

  private saveToken() {
    if (this.token && this.context) {
      this.context.globalState.update('costa.oauth2.token', JSON.stringify(this.token))
    }
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<any> {
    // Determine API base URL (use environment variable in development)
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || config.apiBaseUrl || 'https://ai.costa.app'

    // Get OAuth2 configuration
    const clientId = config.oauth2.clientId
    const redirectUri = config.oauth2.redirectUri

    getOutputChannel().appendLine(`exchangeCodeForToken - Client ID: ${clientId}`)
    getOutputChannel().appendLine(`exchangeCodeForToken - Redirect URI: ${redirectUri}`)

    const tokenUrl = new URL(`${apiBaseUrl}/oauth/token`)

    if (!clientId || !redirectUri) {
      throw new Error('OAuth2 configuration error: clientId or redirectUri is undefined');
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
  -d "code_verifier=${codeVerifier}"`;

    debugLog(`CURL command for testing token exchange:`)
    debugLog(curlCommand)

    // In a real implementation, we would make an HTTP request to exchange the code
    // For now, let's simulate a successful response
    return {
      access_token: 'simulated_access_token',
      refresh_token: 'simulated_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    }
  }

  private clearToken() {
    if (this.context) {
      this.context.globalState.update('costa.oauth2.token', undefined)
      this.context.globalState.update('costa.oauth2.state', undefined)
    }
  }
}

// Export singleton instance
export const oauth2Client = new OAuth2Client()

// Add startup logging to verify logging is working
debugLog('OAuth2 client initialized')
