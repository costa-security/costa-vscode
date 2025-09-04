import type { Uri } from 'vscode'
import { defineExtension, useCommands } from 'reactive-vscode'
import { commands, StatusBarAlignment, ThemeColor, window } from 'vscode'
import { getOutputChannel } from './api'
import { oauth2Client } from './oauth'
import { PrimaryStatus } from './status/primaryStatus'
import { PointsStatus } from './status/pointsStatus'
import { ContextStatus } from './status/contextStatus'
import { LoginPanel } from './ui/loginPanel';

const { activate, deactivate } = defineExtension((context) => {
  // Initialize OAuth2 client with context
  oauth2Client.setContext(context)

  // Add startup logging
  getOutputChannel().appendLine('Costa extension activated')
  console.warn('Costa extension activated - startup logging working')

  window.showInformationMessage('opening the pod bay doors...')


  // 1. Create status bar items
  const primaryStatus = new PrimaryStatus()
  context.subscriptions.push(primaryStatus)

  const pointsStatus = new PointsStatus()
  context.subscriptions.push(pointsStatus)

  // Create context length status bar item
  const contextStatus = new ContextStatus()
  context.subscriptions.push(contextStatus)

  // If we are not logged in, only show primary and make it a warning
  void oauth2Client.getAccessToken()
    .then(Boolean)
    .then(isLoggedIn => {
      if (isLoggedIn) {
        primaryStatus.setLoggedIn()
        pointsStatus.show()
        contextStatus.show()
      } else {
        primaryStatus.setLoggedOut()
        pointsStatus.hide()
        contextStatus.hide()
      }
    })

  // Register all commands
  useCommands({
    'costa.showExtensionInfo': () => {
      window.showInformationMessage('💫 ready to explore the universe?')
    },
    'costa.showLoginPanel': () => {
      LoginPanel.show(context);   // open or focus the singleton
    },
    'costa.login': async () => {
      window.showInformationMessage('Starting Costa authentication process...');
      const success = await oauth2Client.login();
      if (success) {
        window.showInformationMessage('Successfully logged in to Costa');
        LoginPanel.closeIfOpen();  // ✅ ensure any open login panel is closed
        primaryStatus.setLoggedIn();
      }
    },
    'costa.logout': async () => {
      await oauth2Client.logout()
      window.showInformationMessage('Logged out from Costa')
      primaryStatus.setLoggedOut()
    },
    'costa.oauthCallback': async (uri: Uri) => {
      // This command will be called when the OAuth callback URI is opened
      // Forward to the OAuth2 client
      console.warn('Received OAuth callback URI:', uri.toString())
      getOutputChannel().appendLine(`Received OAuth callback URI: ${uri.toString()}`)
      oauth2Client.handleCallback(uri)
    },
    'costa.doSSEStuff': () => {
      window.showInformationMessage('did something')
    }
  })

  // Handle URI callbacks
  context.subscriptions.push(
    window.registerUriHandler({
      handleUri(uri: Uri) {
        console.log('URI Handler received:', uri.toString())
        getOutputChannel().appendLine(`URI Handler received: ${uri.toString()}`)

        // Check if this is our OAuth callback
        if (uri.path === '/callback') {
          // Execute the callback command with the URI
          commands.executeCommand('costa.oauthCallback', uri)
        }
        else {
          getOutputChannel().appendLine(`Unknown URI path: ${uri.path}`)
        }
      },
    }),
  )

  // Return a cleanup function to dispose the status bar items
  return () => {
  }
})

export { activate, deactivate }
