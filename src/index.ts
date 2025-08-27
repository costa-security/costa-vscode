import { defineExtension } from 'reactive-vscode'
import { commands, StatusBarAlignment, ThemeColor, window } from 'vscode'

const { activate, deactivate } = defineExtension(() => {
  window.showInformationMessage('opening the pod bay doors...')

  // Create a status bar item
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100)
  statusBarItem.text = '💫'
  statusBarItem.tooltip = 'Costa VS Code Extension'
  statusBarItem.command = 'costa.showExtensionInfo'
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

  // Register commands for different status bar actions
  const extensionInfoCommand = commands.registerCommand('costa.showExtensionInfo', () => {
    window.showInformationMessage('💫 ready to explore the universe?')
  })

  const progressDetailsCommand = commands.registerCommand('costa.showProgressDetails', () => {
    const percentage = (currentCount / totalCount) * 100
    window.showInformationMessage(`Costa Progress: ${currentCount}/${totalCount} (${Math.round(percentage)}%)`)
  })

  const contextDetailsCommand = commands.registerCommand('costa.showContextDetails', () => {
    const contextLength = Math.floor(Math.random() * (120000)) + 1000
    window.showInformationMessage(`Context Length: ${contextLength.toLocaleString()} tokens`)
  })

  // Return a cleanup function to dispose the status bar items
  return () => {
    statusBarItem.dispose()
    countStatusItem.dispose()
    contextStatusItem.dispose()
    clearInterval(intervalId)
    extensionInfoCommand.dispose()
    progressDetailsCommand.dispose()
    contextDetailsCommand.dispose()
  }
})

export { activate, deactivate }
