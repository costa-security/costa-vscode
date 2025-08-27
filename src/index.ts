import { defineExtension } from 'reactive-vscode'
import { window, StatusBarAlignment, ThemeColor, commands } from 'vscode'

const { activate, deactivate } = defineExtension(() => {
  window.showInformationMessage("opening the pod bay doors...")

  // Create a status bar item
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100)
  statusBarItem.text = "💫 costa"
  statusBarItem.tooltip = "Costa VS Code Extension"
  statusBarItem.show()

  // Create count status item
  const countStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 99)

  let currentCount = 0
  const totalCount = 2000
  const intervalTime = 2000 // 2 seconds per update

  const updateCount = () => {
    // Generate random increment between 20-150
    const increment = Math.floor(Math.random() * (150 - 20 + 1)) + 20
    currentCount = Math.min(currentCount + increment, totalCount)
    const percentage = (currentCount / totalCount) * 100

    // Clear previous background color
    countStatusItem.backgroundColor = undefined

    // Set color based on progress
    if (percentage >= 80) {
      countStatusItem.backgroundColor = new ThemeColor('statusBarItem.errorBackground')
    }
    else if (percentage >= 50) {
      countStatusItem.backgroundColor = new
ThemeColor('statusBarItem.warningBackground')
    }

    // Set text with count format
    countStatusItem.text = `${currentCount}/${totalCount}`
    countStatusItem.tooltip = `Costa Progress (${Math.round(percentage)}%)`

    if (currentCount >= totalCount) {
      clearInterval(intervalId)
      countStatusItem.text = `next session 2h:45m`
    }
  }

  countStatusItem.text = `0/${totalCount}`
  countStatusItem.tooltip = "Costa Progress (0%)"
  countStatusItem.command = 'costa.helloWorld'
  countStatusItem.show()

  // Create context length status bar item
  const contextStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 98)

  const updateContextLength = () => {
    const contextLength = Math.floor(Math.random() * (120000)) + 1000

    // Format number with k suffix
    const formatted = contextLength >= 1000 ? `${Math.round(contextLength/1000)}k` :
`${contextLength}`

    // Reset background color
    contextStatusItem.backgroundColor = undefined

    // Set color based on context length

    // Set background or foreground based on context length
    if (contextLength >= 100000) {
      contextStatusItem.backgroundColor = new ThemeColor('statusBarItem.errorBackground');
      contextStatusItem.color = new ThemeColor('statusBarItem.errorForeground');
    } else if (contextLength >= 25000) {
      contextStatusItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
      contextStatusItem.color = new ThemeColor('statusBarItem.warningForeground');
    } else if (contextLength >= 10000) {
      contextStatusItem.backgroundColor = undefined;
      contextStatusItem.color = new ThemeColor('charts.yellow');
    } else {
      contextStatusItem.backgroundColor = undefined;
      contextStatusItem.color = undefined; // revert to default theme text color
    }


    contextStatusItem.text = `$(book) ${formatted}`
    contextStatusItem.tooltip = `Context Length: ${contextLength.toLocaleString()} 
tokens`
    contextStatusItem.command = 'costa.helloWorld'
  }

  updateContextLength()
  contextStatusItem.show()

  // Update context length every interval as well
  const intervalId = setInterval(() => {
    updateCount()
    updateContextLength() // Update context length every iteration too
  }, intervalTime)

  // Register command for hello world panel
  const disposable = commands.registerCommand('costa.helloWorld', () => {
    window.showInformationMessage('Hello World!')
  })

  // Return a cleanup function to dispose the status bar items
  return () => {
    statusBarItem.dispose()
    countStatusItem.dispose()
    contextStatusItem.dispose()
    clearInterval(intervalId)
    disposable.dispose()
  }
})

export { activate, deactivate }
