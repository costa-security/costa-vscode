import { EventEmitter } from 'node:events'
import { log } from './utils/logger'
import { oauth2Client } from './oauth'
import { API_BASE_URL } from './config'
import * as process from 'node:process'

export interface UsageData {
  points: number
  total_points: number
  context_length: number | string // Can be a number or '-k'
}

export class UsageStream extends EventEmitter {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private decoder = new TextDecoder()
  private buffer = ''
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isConnecting = false

  constructor() {
    super()
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      return
    }

    this.isConnecting = true
    try {
      await this.fetchStream()
    } catch (error) {
      log.error('Error connecting to usage stream:', error)
      this.scheduleReconnect()
    } finally {
      this.isConnecting = false
    }
  }

  private async fetchStream(): Promise<void> {
    // Get access token
    const accessToken = await oauth2Client.getAccessToken()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    // Determine API base URL
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'
    const url = `${apiBaseUrl}/api/v1/usage/stream`

    log.info(`Connecting to usage stream at ${url}`)

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/event-stream',
      },
    })

    log.info('HTTP', res.status, res.statusText)
    for (const [k, v] of res.headers) log.info('↩', k, v)

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Token might be invalid, try to force refresh it
        log.info('Received 401/403, token may be invalid. Attempting to refresh token.')
        try {
          const newToken = await oauth2Client.forceRefreshToken()
          if (newToken) {
            // Retry the request with the new token
            log.info('Token refreshed successfully, retrying connection')
            // Schedule a reconnect with a slight delay to allow the new token to propagate
            setTimeout(() => this.scheduleReconnect(), 1000)
            return
          } else {
            log.info('Failed to refresh token, scheduling reconnect')
            this.scheduleReconnect()
            throw new Error(`HTTP ${res.status} - Failed to refresh token`)
          }
        } catch (refreshError) {
          log.error('Error refreshing token:', refreshError)
          this.scheduleReconnect()
          throw new Error(`HTTP ${res.status} - Token refresh failed: ${refreshError}`)
        }
      }
      throw new Error(`HTTP ${res.status}`)
    }

    if (!res.body) {
      throw new Error('Response body is null')
    }

    this.reader = res.body.getReader()
    let buf = ''

    while (true) {
      const { value, done } = await this.reader.read()
      if (done) break
      buf += this.decoder.decode(value, { stream: true })

      // Parse SSE messages
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const chunk of parts) {
        this.parseSSE(chunk)
      }
    }
  }

  private parseSSE(data: string): void {
    const eventData = data
      .split('\n')
      .filter(l => l.startsWith('data:'))
      .map(l => l.slice(5).trim())
      .join('\n')

    if (eventData) {
      try {
        const usageData: UsageData = JSON.parse(eventData)
        this.emit('usage', usageData)
      } catch (error) {
        log.error('Error parsing SSE data:', error)
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.reader) {
      this.reader.cancel().catch(err => log.error('Error canceling reader:', err))
      this.reader = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(err => log.error('Error reconnecting:', err))
    }, 5000)
  }
}
