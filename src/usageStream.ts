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
    log.info('UsageStream: Starting connection attempt')
    try {
      await this.fetchStream()
    } catch (error) {
      log.error('UsageStream: Error connecting to usage stream:', error)
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

    log.info(`UsageStream: Connecting to usage stream at ${url}`)

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/event-stream',
      },
    })

    log.info('UsageStream: HTTP', res.status, res.statusText)
    for (const [k, v] of res.headers) log.info('↩', k, v)

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Token might be invalid, try to force refresh it
        log.info('UsageStream: Received 401/403, token may be invalid. Attempting to refresh token.')
        try {
          const newToken = await oauth2Client.forceRefreshToken()
          if (newToken) {
            // Retry the request with the new token
            log.info('UsageStream: Token refreshed successfully, retrying connection')
            // Schedule a reconnect with a slight delay to allow the new token to propagate
            setTimeout(() => this.scheduleReconnect(), 1000)
            return
          } else {
            log.info('UsageStream: Failed to refresh token, scheduling reconnect')
            this.scheduleReconnect()
            throw new Error(`HTTP ${res.status} - Failed to refresh token`)
          }
        } catch (refreshError) {
          log.error('UsageStream: Error refreshing token:', refreshError)
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
    log.info('UsageStream: Stream connected and ready to read')

    while (true) {
      const { value, done } = await this.reader.read()
      if (done) {
        log.info('UsageStream: Stream reader done')
        break
      }
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
    log.info('UsageStream: Received SSE data:', data)

    // Check if this is a keepalive/ping event
    if (data.includes('event: keepalive')) {
      log.info('UsageStream: Ignoring keepalive ping event')
      return
    }

    const eventData = data
      .split('\n')
      .filter(l => l.startsWith('data:'))
      .map(l => l.slice(5).trim())
      .join('\n')

    if (eventData) {
      try {
        const parsedData = JSON.parse(eventData)
        log.info('UsageStream: Parsed data:', JSON.stringify(parsedData))

        // Check if this is a ping message (has ping property but no usage data)
        if (parsedData.ping !== undefined && parsedData.points === undefined) {
          log.info('UsageStream: Ignoring ping message:', JSON.stringify(parsedData))
          return
        }

        // Log specific values to debug undefined issues
        log.info(`UsageStream: points=${parsedData.points}, total_points=${parsedData.total_points}, context_length=${parsedData.context_length}`)

        // Check for undefined values
        if (parsedData.points === undefined) {
          log.warn('UsageStream: points is undefined in received data')
        }
        if (parsedData.total_points === undefined) {
          log.warn('UsageStream: total_points is undefined in received data')
        }
        if (parsedData.context_length === undefined) {
          log.warn('UsageStream: context_length is undefined in received data')
        }

        // Only emit usage event if we have actual usage data
        if (parsedData.points !== undefined || parsedData.total_points !== undefined || parsedData.context_length !== undefined) {
          this.emit('usage', parsedData)
        }
      } catch (error) {
        log.error('UsageStream: Error parsing SSE data:', error)
      }
    } else {
      log.warn('UsageStream: Received empty event data')
    }
  }

  disconnect(): void {
    log.info('UsageStream: Disconnecting')
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.reader) {
      this.reader.cancel().catch(err => log.error('UsageStream: Error canceling reader:', err))
      this.reader = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    log.info('UsageStream: Scheduling reconnect in 5 seconds')
    this.reconnectTimeout = setTimeout(() => {
      log.info('UsageStream: Attempting reconnect')
      this.connect().catch(err => log.error('UsageStream: Error reconnecting:', err))
    }, 5000)
  }
}
