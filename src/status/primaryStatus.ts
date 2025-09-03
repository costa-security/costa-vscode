// src/status/primaryStatus.ts
import { StatusBarAlignment, ThemeColor, window, type Disposable } from 'vscode'

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
    this.item.tooltip = 'Logged in to Costa'
  }

  setLoggedOut() {
    this.item.text = '💫 Login to Costa Code'
    this.item.color = new ThemeColor('charts.purple')
    this.item.backgroundColor = new ThemeColor('statusBarItem.warningBackground')
    this.item.tooltip = ''
    this.item.command = 'costa.showLoginPanel'
  }

  dispose() {
    this.item.dispose()
  }
}
