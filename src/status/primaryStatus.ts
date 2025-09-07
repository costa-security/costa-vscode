import type { Disposable } from 'vscode'
import { StatusBarAlignment, ThemeColor, window } from 'vscode'

export class PrimaryStatus implements Disposable {
  private readonly item = window.createStatusBarItem(StatusBarAlignment.Left, 100)

  constructor() {
    this.item.text = '💫'
    this.item.tooltip = 'Costa VS Code Extension'
    this.item.command = 'costa.login'
    this.item.show()
  }

  setLoggedIn() {
    this.item.text = '💫'
    this.item.backgroundColor = new ThemeColor('statusBarItem.activeBackground')
    this.item.tooltip = 'Refresh Costa Points'
    this.item.command = 'costa.refreshPoints' // Changed from costa.login to costa.refreshPoints
  }

  setLoggedOut() {
    this.item.text = '💫 Login to Costa Code'
    this.item.color = new ThemeColor('charts.purple')
    this.item.backgroundColor = new ThemeColor('statusBarItem.warningBackground')
    this.item.tooltip = ''
    this.item.command = 'costa.login'
  }

  dispose() {
    this.item.dispose()
  }
}
