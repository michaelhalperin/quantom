import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { DB } from './db'
import type { MarketCache } from './markets'
import type { Broker } from './engine/broker'
import type { Bot } from './engine/bot'
import { buildSnapshot } from './snapshot'
import { toOrderBook } from './polymarket/map'
import { getConfig, patchConfig, type Config } from './config'
import { STRATEGY_DEFS } from './engine/strategies'
import { log } from './log'
import type { StrategyParam, StrategyStatus } from './types'

export interface Ctx {
  db: DB
  cache: MarketCache
  broker: Broker
  bot: Bot
}

const ALLOWED = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())

function isLocalhost(origin: string): boolean {
  try {
    const u = new URL(origin)
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  // Allow the configured origins plus any localhost dev port (Vite may pick
  // 5173, 5174, … depending on what's free).
  if (ALLOWED.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*')
  else if (origin && (ALLOWED.includes(origin) || isLocalhost(origin)))
    res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(payload)
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

/** Map a moved strategy slider onto the live engine config so it takes effect. */
function applyStrategyParam(strategyId: string, key: string, value: number): void {
  const patch: Partial<Config> = {}
  const cfg = getConfig()
  if (key === 'maxFractionPerTrade') patch.risk = { ...cfg.risk, maxFractionPerTrade: value / 100 }
  else if (key === 'kellyFraction') patch.risk = { ...cfg.risk, kellyFraction: value }
  else if (key === 'arbMinProfit') patch.strategy = { ...cfg.strategy, arbMinProfit: value / 100 }
  else if (key === 'valueMinEdge') patch.strategy = { ...cfg.strategy, valueMinEdge: value / 100 }
  else if (key === 'valueLookback') patch.strategy = { ...cfg.strategy, valueLookback: Math.round(value) }
  if (Object.keys(patch).length) patchConfig(patch)
  void strategyId
}

export function createServer(ctx: Ctx) {
  const { db, cache, broker, bot } = ctx

  return createHttpServer(async (req, res) => {
    cors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    try {
      // --- reads ---
      if (method === 'GET' && (path === '/api/health' || path === '/')) {
        return json(res, 200, { ok: true, service: 'polymarket-paper-bot', mode: 'paper' })
      }

      if (method === 'GET' && path === '/api/snapshot') {
        const snap = buildSnapshot(db, cache, { online: bot.isOnline(), startedAt: bot.startedAt() })
        return json(res, 200, snap)
      }

      const bookMatch = path.match(/^\/api\/book\/(.+)$/)
      if (method === 'GET' && bookMatch) {
        const marketId = decodeURIComponent(bookMatch[1])
        const t = cache.get(marketId)
        if (!t) return json(res, 404, { error: 'unknown market' })
        const yes = await cache.yesBook(marketId)
        return json(res, 200, toOrderBook(t.market, yes))
      }

      // --- actions ---
      if (method === 'POST' && path === '/api/orders') {
        const b = await readBody(req)
        const result = await broker.placeManual({
          marketId: String(b.marketId),
          outcome: b.outcome === 'NO' ? 'NO' : 'YES',
          side: b.side === 'sell' ? 'sell' : 'buy',
          type: b.type === 'market' ? 'market' : 'limit',
          price: Number(b.price),
          size: Number(b.size),
        })
        return json(res, result.ok ? 200 : 400, result)
      }

      const cancelMatch = path.match(/^\/api\/orders\/([^/]+)\/cancel$/)
      if (method === 'POST' && cancelMatch) {
        broker.cancelOrder(decodeURIComponent(cancelMatch[1]))
        return json(res, 200, { ok: true })
      }

      const closeMatch = path.match(/^\/api\/positions\/([^/]+)\/close$/)
      if (method === 'POST' && closeMatch) {
        const trade = await broker.closePosition(decodeURIComponent(closeMatch[1]))
        return json(res, trade ? 200 : 400, { ok: !!trade })
      }

      const toggleMatch = path.match(/^\/api\/strategies\/([^/]+)\/toggle$/)
      if (method === 'POST' && toggleMatch) {
        const id = decodeURIComponent(toggleMatch[1])
        const st = db.strategyStates().find((s) => s.id === id)
        if (!st) return json(res, 404, { error: 'unknown strategy' })
        db.setStrategyStatus(id, st.status === 'running' ? 'paused' : 'running')
        return json(res, 200, { ok: true })
      }

      const statusMatch = path.match(/^\/api\/strategies\/([^/]+)\/status$/)
      if (method === 'POST' && statusMatch) {
        const id = decodeURIComponent(statusMatch[1])
        const b = await readBody(req)
        const status = b.status as StrategyStatus
        if (!['running', 'paused', 'stopped', 'error'].includes(status))
          return json(res, 400, { error: 'bad status' })
        db.setStrategyStatus(id, status)
        return json(res, 200, { ok: true })
      }

      const paramMatch = path.match(/^\/api\/strategies\/([^/]+)\/params$/)
      if (method === 'POST' && paramMatch) {
        const id = decodeURIComponent(paramMatch[1])
        const b = await readBody(req)
        const key = String(b.key)
        const value = Number(b.value)
        const st = db.strategyStates().find((s) => s.id === id)
        if (!st) return json(res, 404, { error: 'unknown strategy' })
        const params: StrategyParam[] = st.params.map((p) => (p.key === key ? { ...p, value } : p))
        db.setStrategyParams(id, params)
        applyStrategyParam(id, key, value)
        return json(res, 200, { ok: true })
      }

      const ackMatch = path.match(/^\/api\/alerts\/([^/]+)\/ack$/)
      if (method === 'POST' && ackMatch) {
        db.ackAlert(decodeURIComponent(ackMatch[1]))
        return json(res, 200, { ok: true })
      }

      const dismissMatch = path.match(/^\/api\/alerts\/([^/]+)$/)
      if ((method === 'DELETE' || method === 'POST') && dismissMatch && path.endsWith(dismissMatch[1])) {
        db.deleteAlert(decodeURIComponent(dismissMatch[1]))
        return json(res, 200, { ok: true })
      }

      if (method === 'POST' && path === '/api/bot/online') {
        const b = await readBody(req)
        bot.setOnline(!!b.online)
        return json(res, 200, { ok: true, online: bot.isOnline() })
      }

      if (method === 'POST' && path === '/api/bot/mode') {
        const b = await readBody(req)
        if (b.mode === 'live') {
          db.insertAlert({
            id: `alert_${Date.now()}`,
            severity: 'warning',
            title: 'Live trading is disabled',
            message: 'This build is paper-only by design. Real-money execution is intentionally not enabled.',
            timestamp: Date.now(),
            acknowledged: false,
          })
          return json(res, 400, { ok: false, reason: 'live mode disabled (paper-only build)' })
        }
        bot.setOnline(b.mode === 'paper')
        return json(res, 200, { ok: true, mode: bot.isOnline() ? 'paper' : 'idle' })
      }

      if (method === 'GET' && path === '/api/settings') {
        const cfg = getConfig()
        let ui: Record<string, unknown> = {}
        try {
          ui = JSON.parse(db.getKv('ui_settings') ?? '{}')
        } catch {
          ui = {}
        }
        return json(res, 200, {
          ui,
          risk: {
            dailyLossLimitPct: cfg.risk.dailyLossLimitPct,
            maxGrossExposurePct: Math.round(cfg.risk.maxGrossExposure * 100),
            autoKillSwitch: cfg.risk.autoKillSwitch,
          },
        })
      }

      if (method === 'POST' && path === '/api/settings') {
        const b = await readBody(req)
        // Persist the dashboard's settings form verbatim.
        if (b.ui && typeof b.ui === 'object') db.setKv('ui_settings', JSON.stringify(b.ui))
        // Apply the risk-relevant fields to the live engine config.
        if (b.risk && typeof b.risk === 'object') {
          const r = b.risk as Record<string, unknown>
          const cfg = getConfig()
          const risk = { ...cfg.risk }
          if (typeof r.dailyLossLimitPct === 'number') risk.dailyLossLimitPct = r.dailyLossLimitPct
          if (typeof r.maxGrossExposurePct === 'number') risk.maxGrossExposure = r.maxGrossExposurePct / 100
          if (typeof r.autoKillSwitch === 'boolean') risk.autoKillSwitch = r.autoKillSwitch
          patchConfig({ risk })
        }
        // Back-compat: allow direct config section patches too.
        if (b.bot || b.strategy || b.universe) patchConfig(b as Partial<Config>)
        return json(res, 200, { ok: true })
      }

      if (method === 'POST' && path === '/api/reset') {
        db.reset()
        db.setNum('balance', getConfig().bot.initialCapital)
        for (const d of STRATEGY_DEFS) db.setStrategyStatus(d.id, 'running')
        broker.emit('info', 'system', 'Paper history reset')
        return json(res, 200, { ok: true })
      }

      return json(res, 404, { error: 'not found', path })
    } catch (err) {
      log.error(`request failed: ${method} ${path}`, (err as Error).message)
      return json(res, 500, { error: 'internal error' })
    }
  })
}
