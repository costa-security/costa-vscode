import * as vscode from 'vscode'

// Get the configuration for the "costa" namespace
const costaConfig = vscode.workspace.getConfiguration('costa')

// Export individual configuration values
export const API_TOKEN = costaConfig.get<string>('apiToken') || ''
export const API_BASE_URL = costaConfig.get<string>('apiBaseUrl') || 'https://ai.costa.app'
export const OAUTH2_CLIENT_ID = costaConfig.get<string>('oauth2.clientId') || '6E1C382C-1034-4466-8CCF-65ED17DBBA3D'
export const OAUTH2_REDIRECT_URI = costaConfig.get<string>('oauth2.redirectUri') || 'vscode://costa.costa-code/callback'

// Export the full config object for convenience
export const config = costaConfig
