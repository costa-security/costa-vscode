// src/status/primaryStatus.ts
import { StatusBarAlignment, window, type Disposable } from 'vscode'

export class PrimaryStatus implements Disposable {
  private readonly item = window.createStatusBarItem(StatusBarAlignment.Left, 100)

  constructor() {
    this.item.text = '💫'
    this.item.tooltip = 'Costa VS Code Extension'
    this.item.command = 'costa.login'
    this.item.show()
  }

  setLoggedIn() {
    this.item.text = '$(check) logged in'
    this.item.tooltip = 'Logged in to Costa'
  }

  setLoggedOut() {
    this.item.text = '💫'
    this.item.tooltip = '💫 Click to login'
  }

  dispose() {
    this.item.dispose()
  }
}
