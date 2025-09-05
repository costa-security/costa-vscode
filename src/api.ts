// import type { OutputChannel } from 'vscode'
// import * as process from 'node:process'
// import { window } from 'vscode'
// import { config } from './config'
// import { oauth2Client } from './oauth'

// // Load environment variables in development
// if (process.env.NODE_ENV !== 'production') {
//   import('dotenv').then((dotenv) => {
//     dotenv.config()
//   }).catch(() => {
//     // dotenv not available, skip
//   })
// }

// // Create output channel for logging
// let outputChannel: OutputChannel | null = null

// export function getOutputChannel(): OutputChannel {
//   if (!outputChannel) {
//     outputChannel = window.createOutputChannel('Costa')
//   }
//   return outputChannel
// }

// // Types for the API response
// export interface CostaData {
//   currentCount: number
//   totalCount: number
//   contextLength: number
// }

// // WebSocket connection
// let socket: WebSocket | null = null
// let reconnectTimeout: NodeJS.Timeout | null = null

// // Callback for when data is received
// let onDataChange: ((data: CostaData) => void) | null = null
// let onConnectionStatusChange: ((connected: boolean) => void) | null = null

// export function setDataCallback(callback: (data: CostaData) => void) {
//   onDataChange = callback
// }

// export function setConnectionStatusCallback(callback: (connected: boolean) => void) {
//   onConnectionStatusChange = callback
// }

// export async function connectToAPI() {
//   // Clear any existing reconnection timeout
//   if (reconnectTimeout) {
//     clearTimeout(reconnectTimeout)
//     reconnectTimeout = null
//   }

//   // Get OAuth2 access token
//   const accessToken = await oauth2Client.getAccessToken()

//   // Check if we have a valid token
//   if (!accessToken) {
//     // Try to login if not logged in
//     if (!oauth2Client.isLoggedIn()) {
//       window.showErrorMessage('Please log in to Costa first using the "Costa: Login" command.')
//     }
//     else {
//       window.showErrorMessage('Your session has expired. Please log in again using the "Costa: Login" command.')
//     }
//     return
//   }

//   // Close existing connection if any
//   if (socket) {
//     socket.close()
//   }

//   try {
//     // Determine API base URL (use environment variable in development)
//     const apiBaseUrl = process.env.COSTA_API_BASE_URL || config.apiBaseUrl
//     const wsUrl = `${apiBaseUrl.replace('http', 'ws')}/websocket`
//     socket = new WebSocket(`${wsUrl}?token=${accessToken}`)

//     socket.onopen = () => {
//       log.info('Connected to Costa API')
//       onConnectionStatusChange?.(true)
//     }

//     socket.onmessage = (event) => {
//       try {
//         const data: CostaData = JSON.parse(event.data)
//         onDataChange?.(data)
//       }
//       catch (error) {
//         log.info(`Error parsing Costa API message: ${error}`)
//       }
//     }

//     socket.onclose = () => {
//       log.info('Disconnected from Costa API')
//       onConnectionStatusChange?.(false)
//       // Attempt to reconnect after 5 seconds
//       reconnectTimeout = setTimeout(connectToAPI, 5000)
//     }

//     socket.onerror = (error) => {
//       log.info(`Costa API connection error: ${error}`)
//       window.showErrorMessage('Failed to connect to Costa API. Check your token and network connection.')
//     }
//   }
//   catch (error) {
//     log.info(`Error connecting to Costa API: ${error}`)
//     window.showErrorMessage(`Error connecting to Costa API: ${(error as Error).message}`)
//   }
// }

// export function disconnectFromAPI() {
//   if (reconnectTimeout) {
//     clearTimeout(reconnectTimeout)
//     reconnectTimeout = null
//   }

//   if (socket) {
//     socket.close()
//     socket = null
//   }
// }
