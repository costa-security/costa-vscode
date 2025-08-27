import type { OutputChannel } from 'vscode'
import { window } from 'vscode'
import { config } from './config'

// Create output channel for logging
let outputChannel: OutputChannel | null = null

function getOutputChannel(): OutputChannel {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel('Costa')
  }
  return outputChannel
}

// Types for the API response
export interface CostaData {
  currentCount: number
  totalCount: number
  contextLength: number
}

// WebSocket connection
let socket: WebSocket | null = null
let reconnectTimeout: NodeJS.Timeout | null = null

// Callback for when data is received
let onDataChange: ((data: CostaData) => void) | null = null
let onConnectionStatusChange: ((connected: boolean) => void) | null = null

export function setDataCallback(callback: (data: CostaData) => void) {
  onDataChange = callback
}

export function setConnectionStatusCallback(callback: (connected: boolean) => void) {
  onConnectionStatusChange = callback
}

export function connectToAPI() {
  // Clear any existing reconnection timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  // Check if we have an API token
  if (!config.apiToken) {
    window.showErrorMessage('Costa API token not configured. Please set costa.apiToken in your settings.')
    return
  }

  // Close existing connection if any
  if (socket) {
    socket.close()
  }

  try {
    // Create WebSocket connection
    const wsUrl = `${config.apiEndpoint.replace('http', 'ws')}/websocket`
    socket = new WebSocket(`${wsUrl}?token=${config.apiToken}`)

    socket.onopen = () => {
      getOutputChannel().appendLine('Connected to Costa API')
      onConnectionStatusChange?.(true)
    }

    socket.onmessage = (event) => {
      try {
        const data: CostaData = JSON.parse(event.data)
        onDataChange?.(data)
      }
      catch (error) {
        getOutputChannel().appendLine(`Error parsing Costa API message: ${error}`)
      }
    }

    socket.onclose = () => {
      getOutputChannel().appendLine('Disconnected from Costa API')
      onConnectionStatusChange?.(false)
      // Attempt to reconnect after 5 seconds
      reconnectTimeout = setTimeout(connectToAPI, 5000)
    }

    socket.onerror = (error) => {
      getOutputChannel().appendLine(`Costa API connection error: ${error}`)
      window.showErrorMessage('Failed to connect to Costa API. Check your token and network connection.')
    }
  }
  catch (error) {
    getOutputChannel().appendLine(`Error connecting to Costa API: ${error}`)
    window.showErrorMessage(`Error connecting to Costa API: ${(error as Error).message}`)
  }
}

export function disconnectFromAPI() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  if (socket) {
    socket.close()
    socket = null
  }
}
