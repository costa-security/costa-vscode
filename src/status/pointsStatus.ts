import { StatusBarAlignment, ThemeColor, window, type Disposable } from 'vscode'
import { log } from '../utils/logger'

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
    log.info('PointsStatus: Initialized with default text')
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
    log.info(`PointsStatus: Update called with points=${points}, total_points=${total_points}`)

    // Check for undefined or invalid values
    if (points === undefined || total_points === undefined ||
        isNaN(Number(points)) || isNaN(Number(total_points))) {
      log.warn(`PointsStatus: Invalid values detected, resetting to default. points=${points}, total_points=${total_points}`)
      this.item.text = '$(sparkle) -/-'
      this.item.color = undefined
      this.item.tooltip = 'Points Usage (-%)'
      return
    }

    try {
      const pct = Math.max(0, Math.min(100, Math.round((points / total_points) * 100)))
      const newText = `$(sparkle) ${points}/${total_points}`
      log.info(`PointsStatus: Setting text to "${newText}" with percentage ${pct}%`)

      this.item.text = newText
      this.item.color = this.colorForPercent(pct)
      this.item.tooltip = `Points Usage (${pct}%)`
    } catch (error) {
      log.error('PointsStatus: Error updating status bar:', error)
      // Fallback to default
      this.item.text = '$(sparkle) -/-'
      this.item.color = undefined
      this.item.tooltip = 'Points Usage (-%)'
    }
  }

  show() {
    log.info('PointsStatus: Show called')
    this.item.show()
  }

  hide() {
    log.info('PointsStatus: Hide called')
    this.item.hide()
  }

  dispose() {
    log.info('PointsStatus: Dispose called')
    this.item.dispose()
  }
}
