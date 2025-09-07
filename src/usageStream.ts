import { EventEmitter } from 'node:events'
import * as process from 'node:process'
import { API_BASE_URL } from './config'
import { oauth2Client } from './oauth'
import { log } from './utils/logger'

export interface UsageData {
  points: number | string // Can be a number or a string like '∞'
  total_points: number | string // Can be a number or a string like '∞'
  context_length: number | string // Can be a number or '-k'
}

export class UsageStream extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null
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
      // Fetch initial usage data
      await this.fetchUsageData()

      // Set up polling every 30 seconds
      this.setupPolling()
    }
    catch (error) {
      log.error('UsageStream: Error connecting to usage API:', error)
      this.scheduleReconnect()
    }
    finally {
      this.isConnecting = false
    }
  }

  private setupPolling(): void {
    // Clear any existing polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
    }

    // Poll every 30 seconds
    log.info('UsageStream: Setting up polling interval (30s)')
    this.pollInterval = setInterval(() => {
      this.fetchUsageData().catch((err) => {
        log.error('UsageStream: Error polling usage data:', err)
        // If we fail to fetch data, attempt to reconnect
        if (err.message.includes('401') || err.message.includes('403')) {
          this.scheduleReconnect()
        }
      })
    }, 30000)
  }

  private async fetchUsageData(): Promise<void> {
    // Get access token
    const accessToken = await oauth2Client.getAccessToken()
    if (!accessToken) {
      throw new Error('No access token available')
    }

    // Determine API base URL
    const apiBaseUrl = process.env.COSTA_API_BASE_URL || API_BASE_URL || 'https://ai.costa.app'
    const url = `${apiBaseUrl}/api/v1/usage`

    log.info(`UsageStream: Fetching usage data from ${url}`)

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    log.info('UsageStream: HTTP', res.status, res.statusText)

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Token might be invalid, try to force refresh it
        log.info('UsageStream: Received 401/403, token may be invalid. Attempting to refresh token.')
        try {
          const newToken = await oauth2Client.forceRefreshToken()
          if (newToken) {
            // Retry the request with the new token
            log.info('UsageStream: Token refreshed successfully, retrying fetch')
            // Schedule a reconnect with a slight delay to allow the new token to propagate
            setTimeout(() => this.scheduleReconnect(), 1000)
            return
          }
          else {
            log.info('UsageStream: Failed to refresh token, scheduling reconnect')
            this.scheduleReconnect()
            throw new Error(`HTTP ${res.status} - Failed to refresh token`)
          }
        }
        catch (refreshError) {
          log.error('UsageStream: Error refreshing token:', refreshError)
          this.scheduleReconnect()
          throw new Error(`HTTP ${res.status} - Token refresh failed: ${refreshError}`)
        }
      }
      throw new Error(`HTTP ${res.status}`)
    }

    // Parse the JSON response
    const data = await res.json() as UsageData
    const json_data = JSON.stringify(data)
    log.info('UsageStream: Received usage data:', JSON.stringify(json_data))

    // Log specific values to debug undefined issues
    log.info(`UsageStream: points=${data.points}, total_points=${data.total_points}, context_length=${data.context_length}`)

    // Check for undefined values
    if (data.points === undefined) {
      log.warn('UsageStream: points is undefined in received data')
    }
    if (data.total_points === undefined) {
      log.warn('UsageStream: total_points is undefined in received data')
    }
    if (data.context_length === undefined) {
      log.warn('UsageStream: context_length is undefined in received data')
    }

    // Only emit usage event if we have actual usage data
    if (data.points !== undefined || data.total_points !== undefined || data.context_length !== undefined) {
      this.emit('usage', data)
    }
  }

  disconnect(): void {
    log.info('UsageStream: Disconnecting')

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
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
