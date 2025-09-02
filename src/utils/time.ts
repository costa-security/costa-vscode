export function formatAbsoluteLocal(epochSeconds: number) {
  const d = new Date(epochSeconds * 1000)
  const fmt = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `${fmt.format(d)} (${tz})`
}

export function formatRelativeToNow(epochSeconds: number) {
  const now = Date.now()
  const diffMs = epochSeconds * 1000 - now
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  const absMs = Math.abs(diffMs)
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [86400000, 'day'],
    [3600000, 'hour'],
    [60000, 'minute'],
    [1000, 'second'],
  ]

  for (const [unitMs, unit] of units) {
    if (absMs >= unitMs || unit === 'second') {
      return rtf.format(Math.round(diffMs / unitMs), unit)
    }
  }

  return rtf.format(0, 'second')
}

export function formatExpiryLine(expiresAt?: number) {
  if (!expiresAt) return 'N/A'
  const absolute = formatAbsoluteLocal(expiresAt)
  const relative = formatRelativeToNow(expiresAt)
  const expired = expiresAt * 1000 <= Date.now()
  return `${absolute} — ${relative}${expired ? ' (EXPIRED)' : ''}`
}
