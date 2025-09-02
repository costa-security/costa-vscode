import { StatusBarAlignment, ThemeColor, window, type Disposable } from 'vscode'

/**
 * Points usage status item.
 * Call `update(percentage)` whenever we receive new data.
 */
export class PointsStatus implements Disposable {
  private readonly item = window.createStatusBarItem(StatusBarAlignment.Left, 99)

  constructor() {
    this.item.text = '$(sparkle) -/-'
    this.item.tooltip = 'Points Usage (-%)'
    this.item.command = 'costa.showProgressDetails'
    this.item.show()
  }

  /**
   * Map percentage → VS Code theme color.
   */
  private colorForPercent(pct: number) {
    if (pct >= 75) return new ThemeColor('charts.red')
    if (pct >= 50) return new ThemeColor('charts.yellow')
    if (pct >= 25) return new ThemeColor('charts.green')
    return undefined
  }

  /**
   * Update the status bar to show current percentage (0–100).
   * Clamps out-of-range inputs and formats tooltip/text.
   */
  update(points: number, total_points: number) {
    const pct = Math.max(0, Math.min(100, Math.round((points / total_points) * 100)))
    this.item.text = `$(sparkle) ${points}/${total_points}`
    this.item.color = this.colorForPercent(pct)
    this.item.tooltip = `Points Usage (${pct}%)`
  }

  dispose() {
    this.item.dispose()
  }
}
