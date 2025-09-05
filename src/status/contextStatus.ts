import { StatusBarAlignment, ThemeColor, window, type Disposable } from 'vscode'

/**
 * Points usage status item.
 * Call `update(percentage)` whenever we receive new data.
 */
export class ContextStatus implements Disposable {
  private readonly item = window.createStatusBarItem(StatusBarAlignment.Left, 98)

  constructor() {
    this.item.text = '$(book) -k'
    this.item.tooltip = 'Context Length: -'
    this.item.show()
  }

  /**
   * Map context length → VS Code theme color.
   */
  private colorForContextLength(context_length: number) {
    if (context_length >= 100000) return new ThemeColor('charts.red')
    if (context_length >= 25000) return new ThemeColor('charts.yellow')
    if (context_length >= 10000) return new ThemeColor('charts.green')
    return undefined
  }

  private formatForDisplay(context_length: number) {
    const formatted = context_length >= 1000
      ? `${Math.round(context_length / 1000)}k`
      : `${context_length}`
    return formatted;
  }

  /**
   * Update the status bar to show current context length (0–100).
   * Clamps out-of-range inputs and formats tooltip/text.
   */
  update(context_length: number) {
    this.item.text = `$(book) ${this.formatForDisplay(context_length)}`
    this.item.color = this.colorForContextLength(context_length)
    this.item.tooltip = `Context Length: ${context_length}`
  }

  show() {
    this.item.show()
  }

  hide() {
    this.item.hide()
  }

  dispose() {
    this.item.dispose()
  }
}
