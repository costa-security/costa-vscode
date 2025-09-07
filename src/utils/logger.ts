/* eslint-disable no-console */
import process from 'node:process'
import * as vscode from 'vscode'

let output: vscode.OutputChannel | undefined
let isDev = false
let initialized = false

export function initLogger(
  context: vscode.ExtensionContext,
  opts: { channelName?: string } = {},
) {
  isDev = context.extensionMode === vscode.ExtensionMode.Development
  output = vscode.window.createOutputChannel(opts.channelName ?? 'Costa')
  initialized = true
}

function ensure() {
  // In dev, warn loudly if you forgot to init.
  if (!initialized && process.env.NODE_ENV !== 'production') {
    console.warn('[logger] used before initLogger() ran')
  }
}

export const log = {
  debug: (...args: any[]) => {
    ensure()
    if (isDev) {
      console.log(...args)
      output?.appendLine(`[DEBUG] ${args.map(String).join(' ')}`)
    }
  },
  info: (...args: any[]) => {
    ensure()
    console.log(...args)
    output?.appendLine(`[INFO] ${args.map(String).join(' ')}`)
  },
  warn: (...args: any[]) => {
    ensure()
    console.warn(...args)
    output?.appendLine(`[WARN] ${args.map(String).join(' ')}`)
  },
  error: (...args: any[]) => {
    ensure()
    console.error(...args)
    output?.appendLine(`[ERROR] ${args.map(String).join(' ')}`)
  },
}
