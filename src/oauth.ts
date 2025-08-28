import type { ExtensionContext } from 'vscode'
import * as crypto from 'node:crypto'
import * as process from 'node:process'
import { env, Uri, window } from 'vscode'
import { getOutputChannel } from './api'
import { config } from './config'

// Use a more comprehensive logging approach
function debugLog(message: string) {
  console.warn(`[COSTA-OAUTH] ${message}`)  // This goes to Debug Console
  try {
    getOutputChannel().appendLine(message)      // This goes to Output panel
  } catch {
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

      // Create state parameter for security
      const state = crypto.randomBytes(16).toString('hex')

      // Store state in global state for verification later
      if (this.context) {
        this.context.globalState.update('costa.oauth2.state', state)
      }

      // Determine API base URL (use environment variable in development)
      const apiBaseUrl = process.env.COSTA_API_BASE_URL || config.apiBaseUrl

      // Get OAuth2 configuration
      // Log all config values for debugging
      debugLog(`All config values: ${JSON.stringify(config, null, 2)}`)
      debugLog(`Config keys: ${Object.keys(config).join(', ')}`)

      // Check what's in the config object using Object.entries
      debugLog('Config entries:')
      for (const [key, value] of Object.entries(config)) {
        debugLog(`  ${key}: ${value} (${typeof value})`)
      }

      // Try accessing the values directly using dot notation vs bracket notation
      debugLog(`config.apiBaseUrl: ${config.apiBaseUrl}`)
      debugLog(`config['apiBaseUrl']: ${config['apiBaseUrl']}`)

      // Try different ways of accessing the nested properties
      debugLog(`Direct access - config['oauth2.clientId']: ${config['oauth2.clientId']}`)
      // @ts-expect-error - This is for debugging only
      debugLog(`Try with object path - config.oauth2?.clientId: ${config.oauth2?.clientId || 'undefined/null'}`)

      // Access OAuth2 configuration using the correct shorthand keys
      const clientId = config.costaOauth2ClientId
      const redirectUri = config.costaOauth2RedirectUri

      debugLog(`Correctly accessing config.oauth2.clientId: ${clientId}`)
      debugLog(`Correctly accessing config.oauth2.redirectUri: ${redirectUri}`)

      debugLog(`Trying to access config['oauth2.clientId']: ${config['oauth2.clientId']}`)
      debugLog(`Type of config['oauth2.clientId']: ${typeof config['oauth2.clientId']}`)
      debugLog(`Trying to access config['oauth2.redirectUri']: ${config['oauth2.redirectUri']}`)
      debugLog(`Type of config['oauth2.redirectUri']: ${typeof config['oauth2.redirectUri']}`)

      debugLog(`API Base URL: ${apiBaseUrl}`)
      debugLog(`Client ID: ${clientId}`)
      debugLog(`Redirect URI: ${redirectUri}`)
      debugLog(`Client ID truthiness: ${!!clientId}`)
      debugLog(`Redirect URI truthiness: ${!!redirectUri}`)

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
      authUrl.searchParams.append('scope', 'openid profile email usage_information user_actions')
      authUrl.searchParams.append('state', state)
      authUrl.searchParams.append('code_challenge', codeChallenge)
      authUrl.searchParams.append('code_challenge_method', 'S256')

      // Open browser to start authentication
      const uri = Uri.parse(authUrl.toString())
      await env.openExternal(uri)

      getOutputChannel().appendLine(`Opened browser for OAuth2 authentication: ${authUrl.toString()}`)
      window.showInformationMessage('Opened browser for Costa authentication. Please complete the login process.')

      // In a real implementation, we would need to handle the redirect
      // For now, let's show a message to the user
      window.showInformationMessage('Please complete authentication in your browser. After logging in, you will be redirected back to VS Code.')

      // In a complete implementation, we would set up a proper redirect handler
      // For now, let's wait a bit and then ask the user to paste the code from the callback URL
      await new Promise(resolve => setTimeout(resolve, 5000))

      const codeInput = await window.showInputBox({
        prompt: 'Enter the authorization code from the callback URL (the "code" parameter)',
        placeHolder: 'Authorization code',
        ignoreFocusOut: true,
      })

      if (codeInput) {
        // Exchange the authorization code for an access token
        try {
          const tokenResponse = await this.exchangeCodeForToken(codeInput, this.codeVerifier!)

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
          return true
        } catch (error) {
          getOutputChannel().appendLine(`OAuth2 token exchange error: ${error}`)
          window.showErrorMessage(`OAuth2 token exchange failed: ${error}`)
          return false
        }
      } else {
        window.showErrorMessage('Login cancelled - no authorization code provided')
        return false
      }
    } catch (error) {
      getOutputChannel().appendLine(`OAuth2 login error: ${error}`)
      window.showErrorMessage(`OAuth2 login failed: ${error}`)
      return false
    }
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
    } catch (error) {
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
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || config.apiBaseUrl

    // Get OAuth2 configuration
    debugLog(`exchangeCodeForToken - All config values: ${JSON.stringify(config, null, 2)}`)
    const clientId = config.costaOauth2ClientId
    const redirectUri = config.costaOauth2RedirectUri

    getOutputChannel().appendLine(`exchangeCodeForToken - Client ID: ${clientId}`)
    getOutputChannel().appendLine(`exchangeCodeForToken - Redirect URI: ${redirectUri}`)

    const tokenUrl = new URL(`${apiBaseUrl}/oauth/token`)

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    })

    getOutputChannel().appendLine(`Exchanging code for token at: ${tokenUrl.toString()}`)
    getOutputChannel().appendLine(`Token request params: ${params.toString()}`)

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
