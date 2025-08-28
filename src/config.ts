import * as vscode from 'vscode';

// Fetches the whole config scope for the "costa" namespace
const costaConfig = vscode.workspace.getConfiguration('costa');

// Now you can safely read individual properties:
const apiToken   = costaConfig.get<string>('apiToken');
const apiBaseUrl = costaConfig.get<string>('apiBaseUrl');
const clientId   = costaConfig.get<string>('oauth2.clientId');
const redirect   = costaConfig.get<string>('oauth2.redirectUri');

export const config = vscode.workspace.getConfiguration('costa');
