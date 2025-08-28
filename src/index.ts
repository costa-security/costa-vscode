import { defineExtension, useCommands } from 'reactive-vscode'
import { commands, StatusBarAlignment, ThemeColor, window, Uri } from 'vscode'
import { getOutputChannel } from './api'
import { oauth2Client } from './oauth'

const { activate, deactivate } = defineExtension((context) => {
  // Initialize OAuth2 client with context
  oauth2Client.setContext(context)

  // Add startup logging
  getOutputChannel().appendLine('Costa extension activated')
  console.warn('Costa extension activated - startup logging working')

  window.showInformationMessage('opening the pod bay doors...')

  // Create a status bar item
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100)
  statusBarItem.text = '💫'
  statusBarItem.tooltip = 'Costa VS Code Extension - Click to login'
  statusBarItem.command = 'costa.login'
  statusBarItem.show()

  // Create count status item
  const countStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 99)

  let currentCount = 0
  const totalCount = 2000
  const intervalTime = 2000 // 2 seconds per update

  let intervalId: NodeJS.Timeout

  const updateCount = () => {
    // Generate random increment between 20-150
    const increment = Math.floor(Math.random() * (150 - 20 + 1)) + 20
    currentCount = Math.min(currentCount + increment, totalCount)
    const percentage = (currentCount / totalCount) * 100

    // Clear previous background color
    countStatusItem.backgroundColor = undefined
    countStatusItem.color = undefined

    // Set color based on progress using charts colors
    if (percentage >= 75) {
      countStatusItem.color = new ThemeColor('charts.red')
    }
    else if (percentage >= 50) {
      countStatusItem.color = new ThemeColor('charts.yellow')
    }
    else if (percentage >= 25) {
      countStatusItem.color = new ThemeColor('charts.green')
    }
    else {
      // fallback
      countStatusItem.color = undefined
    }

    // Set text with count format
    countStatusItem.text = `$(sparkle) ${currentCount}/${totalCount}`
    countStatusItem.tooltip = `Costa Progress (${Math.round(percentage)}%)`

    if (currentCount >= totalCount) {
      clearInterval(intervalId)
      countStatusItem.text = `next session 2h:45m`
    }
  }

  countStatusItem.text = `$(sparkle) -/${totalCount}`
  countStatusItem.tooltip = 'Costa Progress (-%)'
  countStatusItem.command = 'costa.showProgressDetails'
  countStatusItem.show()

  // Create context length status bar item
  const contextStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 98)

  const updateContextLength = () => {
    const contextLength = Math.floor(Math.random() * (120000)) + 1000

    // Format number with k suffix
    const formatted = contextLength >= 1000
      ? `${Math.round(contextLength / 1000)}k`
      : `${contextLength}`

    // Reset background color
    contextStatusItem.backgroundColor = undefined
    contextStatusItem.color = undefined

    // Set color based on context length using charts colors
    if (contextLength >= 100000) {
      contextStatusItem.color = new ThemeColor('charts.red')
    }
    else if (contextLength >= 25000) {
      contextStatusItem.color = new ThemeColor('charts.yellow')
    }
    else if (contextLength >= 10000) {
      contextStatusItem.color = new ThemeColor('charts.green')
    }
    else {
      // Do nothing
    }

    contextStatusItem.text = `$(book) ${formatted}`
    contextStatusItem.tooltip = `Context Length: ${contextLength.toLocaleString()} tokens`
    contextStatusItem.command = 'costa.showContextDetails'
  }

  updateContextLength()
  contextStatusItem.show()

  // Update context length every interval as well
  intervalId = setInterval(() => {
    updateCount()
    updateContextLength() // Update context length every iteration too
  }, intervalTime)

  // Register all commands
  useCommands({
    'costa.showExtensionInfo': () => {
      window.showInformationMessage('💫 ready to explore the universe?')
    },
    'costa.showProgressDetails': () => {
      const percentage = (currentCount / totalCount) * 100
      window.showInformationMessage(`Costa Progress: ${currentCount}/${totalCount} (${Math.round(percentage)}%)`)
    },
    'costa.showContextDetails': () => {
      const contextLength = Math.floor(Math.random() * (120000)) + 1000
      window.showInformationMessage(`Context Length: ${contextLength.toLocaleString()} tokens`)
    },
    'costa.login': async () => {
      window.showInformationMessage('Starting Costa authentication process...')
      const success = await oauth2Client.login()
      if (success) {
        window.showInformationMessage('Successfully logged in to Costa')
      }
    },
    'costa.logout': async () => {
      oauth2Client.logout()
      window.showInformationMessage('Logged out from Costa')
    },
    'costa.oauthCallback': async (uri: Uri) => {
      // This command will be called when the OAuth callback URI is opened
      // Forward to the OAuth2 client
      console.log('Received OAuth callback URI:', uri.toString())
      getOutputChannel().appendLine(`Received OAuth callback URI: ${uri.toString()}`)
      oauth2Client.handleCallback(uri)
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
        } else {
          getOutputChannel().appendLine(`Unknown URI path: ${uri.path}`)
        }
      }
    })
  )

  // Return a cleanup function to dispose the status bar items
  return () => {
    statusBarItem.dispose()
    countStatusItem.dispose()
    contextStatusItem.dispose()
    clearInterval(intervalId)
  }
})

export { activate, deactivate }
