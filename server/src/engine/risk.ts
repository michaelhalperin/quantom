import type { DB } from '../db'
import type { Marked } from '../portfolio'
import type { MarketCategory, RiskLimit, LimitStatus, PortfolioSnapshot } from '../types'
import type { Config } from '../config'
import { clamp, kellyFraction, round, id, HOUR } from '../util'

/**
 * Position size (in shares) for a value bet, from fractional Kelly, clamped by
 * the per-trade, gross-exposure and per-category caps. Returns 0 when no size
 * is justified or a cap is already hit.
 */
export function sizeShares(
  fair: number,
  price: number,
  equity: number,
  balance: number,
  category: MarketCategory,
  marked: Marked,
  minOrderSize: number,
  cfg: Config,
): number {
  if (equity <= 0 || price <= 0 || price >= 1) return 0
  const g = clamp(kellyFraction(fair, price) * cfg.risk.kellyFraction, 0, cfg.risk.maxFractionPerTrade)
  if (g <= 0) return 0

  let cost = g * equity
  const grossRoom = cfg.risk.maxGrossExposure * equity - marked.positionsValue
  const catRoom = cfg.risk.maxFractionPerCategory * equity - (marked.byCategory.get(category)?.value ?? 0)
  cost = Math.min(cost, grossRoom, catRoom, balance)
  if (cost <= 0) return 0

  const shares = cost / price
  return shares >= minOrderSize ? round(shares, 2) : 0
}

function statusFor(current: number, limit: number): LimitStatus {
  if (limit <= 0) return 'ok'
  const r = current / limit
  if (r >= 1) return 'breach'
  if (r >= 0.7) return 'warning'
  return 'ok'
}

/** Build the dashboard's risk-limit gauges from live portfolio state. */
export function buildRiskLimits(
  portfolio: PortfolioSnapshot,
  marked: Marked,
  openOrders: number,
  cfg: Config,
): RiskLimit[] {
  const equity = portfolio.equity || 1
  const dayLoss = clamp(-portfolio.dayPnlPct, 0, 100)
  const exposurePct = round(portfolio.exposure * 100, 1)
  const maxPos = Math.max(0, ...marked.positions.map((p) => p.value))
  const concentration = round((maxPos / equity) * 100, 1)

  let topCat: MarketCategory | null = null
  let topCatVal = 0
  for (const [cat, e] of marked.byCategory) if (e.value > topCatVal) ((topCatVal = e.value), (topCat = cat))
  const topCatPct = round((topCatVal / equity) * 100, 1)

  const perTradeCap = round(cfg.risk.maxFractionPerTrade * 100, 0)
  const catCap = round(cfg.risk.maxFractionPerCategory * 100, 0)
  const exposureCap = round(cfg.risk.maxGrossExposure * 100, 0)

  return [
    {
      key: 'dayLoss',
      label: 'Daily loss limit',
      description: 'Kill-switch triggers if daily loss exceeds threshold',
      current: round(dayLoss, 1),
      limit: cfg.risk.dailyLossLimitPct,
      unit: '%',
      status: statusFor(dayLoss, cfg.risk.dailyLossLimitPct),
    },
    {
      key: 'exposure',
      label: 'Gross exposure',
      description: 'Total position value vs equity',
      current: exposurePct,
      limit: exposureCap,
      unit: '%',
      status: statusFor(exposurePct, exposureCap),
    },
    {
      key: 'concentration',
      label: 'Single-market cap',
      description: 'Largest position vs equity',
      current: concentration,
      limit: perTradeCap,
      unit: '%',
      status: statusFor(concentration, perTradeCap),
    },
    {
      key: 'topCategory',
      label: topCat ? `${topCat} category cap` : 'Top category cap',
      description: 'Largest category exposure vs equity',
      current: topCatPct,
      limit: catCap,
      unit: '%',
      status: statusFor(topCatPct, catCap),
    },
    {
      key: 'openOrders',
      label: 'Open order count',
      description: 'Concurrent resting orders',
      current: openOrders,
      limit: 50,
      unit: '',
      status: statusFor(openOrders, 50),
    },
  ]
}

/**
 * Returns true if the daily-loss kill switch should fire. Raises a critical
 * alert at most once per hour so we don't spam the feed.
 */
export function checkKillSwitch(portfolio: PortfolioSnapshot, cfg: Config, db: DB): boolean {
  if (!cfg.risk.autoKillSwitch) return false
  if (portfolio.dayPnlPct > -cfg.risk.dailyLossLimitPct) return false
  const title = 'Daily loss limit breached'
  if (!db.hasRecentAlert(title, Date.now() - HOUR)) {
    db.insertAlert({
      id: id('alert'),
      severity: 'critical',
      title,
      message: `Day P&L ${portfolio.dayPnlPct.toFixed(1)}% breached the ${cfg.risk.dailyLossLimitPct}% limit. All strategies paused by the kill switch.`,
      timestamp: Date.now(),
      acknowledged: false,
    })
  }
  return true
}
