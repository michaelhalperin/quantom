import { formatDistanceToNowStrict, format } from 'date-fns'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** $1,234.56 */
export function formatCurrency(n: number, decimals?: 0 | 2) {
  if (!Number.isFinite(n)) return '—'
  return decimals === 0 ? usd0.format(n) : usd.format(n)
}

/** +$1,234.56 / -$12.00 with explicit sign. */
export function formatSignedCurrency(n: number, decimals?: 0 | 2) {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return sign + formatCurrency(n, decimals)
}

/** 1.23K · 4.5M · 1.2B */
export function formatCompact(n: number, currency = false) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const prefix = currency ? '$' : ''
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${prefix}${abs.toFixed(0)}`
}

export function formatNumber(n: number, decimals = 0) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** 0.5 → 50.0% (probability/price as percentage). */
export function formatPercent(n: number, decimals = 1, withSign = false) {
  if (!Number.isFinite(n)) return '—'
  const sign = withSign && n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(decimals)}%`
}

/** A points-based percentage already in human units (e.g. 12.3 → +12.3%). */
export function formatPctPoints(n: number, decimals = 1, withSign = true) {
  if (!Number.isFinite(n)) return '—'
  const sign = withSign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}%`
}

/** Polymarket-style price in cents: 0.63 → "63¢". */
export function formatCents(p: number) {
  if (!Number.isFinite(p)) return '—'
  return `${(p * 100).toFixed(1)}¢`
}

/** Probability as integer percent: 0.63 → "63%". */
export function formatProb(p: number) {
  if (!Number.isFinite(p)) return '—'
  return `${Math.round(p * 100)}%`
}

export function formatShares(n: number) {
  return `${formatNumber(n, n < 10 ? 2 : 0)} sh`
}

export function formatRelativeTime(ts: number) {
  return formatDistanceToNowStrict(ts, { addSuffix: true })
}

export function formatDate(ts: number) {
  return format(ts, 'MMM d, yyyy')
}

export function formatTime(ts: number) {
  return format(ts, 'HH:mm:ss')
}

export function formatDateTime(ts: number) {
  return format(ts, 'MMM d, HH:mm')
}

export function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function truncateAddress(addr: string, lead = 6, tail = 4) {
  if (addr.length <= lead + tail) return addr
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`
}

/** Tailwind text color class for a P&L value. */
export function pnlColor(n: number) {
  if (n > 0) return 'text-profit'
  if (n < 0) return 'text-loss'
  return 'text-muted'
}

export function signOf(n: number) {
  return n > 0 ? '+' : n < 0 ? '-' : ''
}
