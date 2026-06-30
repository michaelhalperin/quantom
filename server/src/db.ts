import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type {
  Order,
  Trade,
  ActivityEvent,
  RiskAlert,
  EquityPoint,
  MarketCategory,
  OutcomeSide,
  StrategyStatus,
  StrategyParam,
} from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

/** Position as stored — live fields (currentPrice/value/pnl) are computed at read time. */
export interface PositionRow {
  id: string
  marketId: string
  question: string
  category: MarketCategory
  icon: string
  side: OutcomeSide
  shares: number
  avgPrice: number
  costBasis: number
  realizedPnl: number
  openedAt: number
  strategyId: string
  strategyName: string
}

export interface StrategyStateRow {
  id: string
  status: StrategyStatus
  params: StrategyParam[]
  createdAt: number
  lastSignal: number
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY, marketId TEXT, question TEXT, category TEXT, icon TEXT,
  side TEXT, shares REAL, avgPrice REAL, costBasis REAL, realizedPnl REAL,
  openedAt INTEGER, strategyId TEXT, strategyName TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, marketId TEXT, question TEXT, icon TEXT, outcome TEXT,
  side TEXT, type TEXT, price REAL, size REAL, filled REAL, status TEXT, tif TEXT,
  createdAt INTEGER, updatedAt INTEGER, strategyId TEXT, strategyName TEXT
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY, marketId TEXT, question TEXT, icon TEXT, category TEXT,
  outcome TEXT, side TEXT, price REAL, size REAL, value REAL, fee REAL,
  pnl REAL, realized INTEGER, timestamp INTEGER, strategyId TEXT, strategyName TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, level TEXT, category TEXT, message TEXT, detail TEXT,
  timestamp INTEGER, marketId TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, severity TEXT, title TEXT, message TEXT,
  timestamp INTEGER, acknowledged INTEGER
);

CREATE TABLE IF NOT EXISTS equity_points (
  t INTEGER PRIMARY KEY, equity REAL, pnl REAL, drawdown REAL
);

CREATE TABLE IF NOT EXISTS strategy_state (
  id TEXT PRIMARY KEY, status TEXT, params TEXT, createdAt INTEGER, lastSignal INTEGER
);

CREATE TABLE IF NOT EXISTS metrics (
  t INTEGER PRIMARY KEY, json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_positions_mkt ON positions(marketId);
`

export class DB {
  private db: DatabaseSync

  constructor(filename = 'polybot.db') {
    mkdirSync(DATA_DIR, { recursive: true })
    this.db = new DatabaseSync(join(DATA_DIR, filename))
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
  }

  // --- key/value -----------------------------------------------------------
  getKv(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }
  setKv(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, value)
  }
  getNum(key: string, fallback: number): number {
    const v = this.getKv(key)
    return v === null ? fallback : Number(v)
  }
  setNum(key: string, value: number): void {
    this.setKv(key, String(value))
  }
  getBool(key: string, fallback: boolean): boolean {
    const v = this.getKv(key)
    return v === null ? fallback : v === '1'
  }
  setBool(key: string, value: boolean): void {
    this.setKv(key, value ? '1' : '0')
  }

  // --- positions -----------------------------------------------------------
  positions(): PositionRow[] {
    return this.db.prepare('SELECT * FROM positions').all() as unknown as PositionRow[]
  }
  positionFor(marketId: string, side: OutcomeSide): PositionRow | undefined {
    return this.db
      .prepare('SELECT * FROM positions WHERE marketId = ? AND side = ?')
      .get(marketId, side) as PositionRow | undefined
  }
  upsertPosition(p: PositionRow): void {
    this.db
      .prepare(
        `INSERT INTO positions
         (id,marketId,question,category,icon,side,shares,avgPrice,costBasis,realizedPnl,openedAt,strategyId,strategyName)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           shares=excluded.shares, avgPrice=excluded.avgPrice, costBasis=excluded.costBasis,
           realizedPnl=excluded.realizedPnl`,
      )
      .run(
        p.id, p.marketId, p.question, p.category, p.icon, p.side, p.shares, p.avgPrice,
        p.costBasis, p.realizedPnl, p.openedAt, p.strategyId, p.strategyName,
      )
  }
  deletePosition(id: string): void {
    this.db.prepare('DELETE FROM positions WHERE id = ?').run(id)
  }

  // --- orders --------------------------------------------------------------
  openOrders(): Order[] {
    return this.db
      .prepare("SELECT * FROM orders WHERE status IN ('open','partial') ORDER BY createdAt DESC")
      .all() as unknown as Order[]
  }
  allOrders(limit = 200): Order[] {
    return this.db
      .prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT ?')
      .all(limit) as unknown as Order[]
  }
  insertOrder(o: Order): void {
    this.db
      .prepare(
        `INSERT INTO orders
         (id,marketId,question,icon,outcome,side,type,price,size,filled,status,tif,createdAt,updatedAt,strategyId,strategyName)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        o.id, o.marketId, o.question, o.icon, o.outcome, o.side, o.type, o.price, o.size,
        o.filled, o.status, o.tif, o.createdAt, o.updatedAt, o.strategyId, o.strategyName,
      )
  }
  updateOrder(id: string, filled: number, status: Order['status']): void {
    this.db
      .prepare('UPDATE orders SET filled=?, status=?, updatedAt=? WHERE id=?')
      .run(filled, status, Date.now(), id)
  }
  getOrder(id: string): Order | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined
  }

  // --- trades --------------------------------------------------------------
  insertTrade(t: Trade): void {
    this.db
      .prepare(
        `INSERT INTO trades
         (id,marketId,question,icon,category,outcome,side,price,size,value,fee,pnl,realized,timestamp,strategyId,strategyName)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        t.id, t.marketId, t.question, t.icon, t.category, t.outcome, t.side, t.price, t.size,
        t.value, t.fee, t.pnl, t.realized ? 1 : 0, t.timestamp, t.strategyId, t.strategyName,
      )
  }
  trades(limit = 400): Trade[] {
    const rows = this.db
      .prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as unknown as (Omit<Trade, 'realized'> & { realized: number })[]
    return rows.map((r) => ({ ...r, realized: !!r.realized }))
  }
  allRealizedTrades(): Trade[] {
    const rows = this.db
      .prepare('SELECT * FROM trades WHERE pnl IS NOT NULL ORDER BY timestamp ASC')
      .all() as unknown as (Omit<Trade, 'realized'> & { realized: number })[]
    return rows.map((r) => ({ ...r, realized: !!r.realized }))
  }

  // --- activity ------------------------------------------------------------
  insertActivity(a: ActivityEvent): void {
    this.db
      .prepare(
        'INSERT INTO activity(id,level,category,message,detail,timestamp,marketId) VALUES (?,?,?,?,?,?,?)',
      )
      .run(a.id, a.level, a.category, a.message, a.detail ?? null, a.timestamp, a.marketId ?? null)
  }
  activity(limit = 140): ActivityEvent[] {
    return this.db
      .prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as unknown as ActivityEvent[]
  }

  // --- alerts --------------------------------------------------------------
  insertAlert(a: RiskAlert): void {
    this.db
      .prepare(
        'INSERT INTO alerts(id,severity,title,message,timestamp,acknowledged) VALUES (?,?,?,?,?,?)',
      )
      .run(a.id, a.severity, a.title, a.message, a.timestamp, a.acknowledged ? 1 : 0)
  }
  alerts(limit = 50): RiskAlert[] {
    const rows = this.db
      .prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as unknown as (Omit<RiskAlert, 'acknowledged'> & { acknowledged: number })[]
    return rows.map((r) => ({ ...r, acknowledged: !!r.acknowledged }))
  }
  ackAlert(id: string): void {
    this.db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id)
  }
  deleteAlert(id: string): void {
    this.db.prepare('DELETE FROM alerts WHERE id = ?').run(id)
  }
  hasRecentAlert(title: string, sinceMs: number): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM alerts WHERE title = ? AND timestamp > ? LIMIT 1')
      .get(title, sinceMs)
    return !!row
  }

  // --- equity curve --------------------------------------------------------
  upsertEquityPoint(p: EquityPoint): void {
    this.db
      .prepare(
        `INSERT INTO equity_points(t,equity,pnl,drawdown) VALUES (?,?,?,?)
         ON CONFLICT(t) DO UPDATE SET equity=excluded.equity, pnl=excluded.pnl, drawdown=excluded.drawdown`,
      )
      .run(p.t, p.equity, p.pnl, p.drawdown)
  }
  equityCurve(limit = 90): EquityPoint[] {
    const rows = this.db
      .prepare('SELECT * FROM equity_points ORDER BY t DESC LIMIT ?')
      .all(limit) as unknown as EquityPoint[]
    return rows.reverse()
  }

  // --- strategy state ------------------------------------------------------
  strategyStates(): StrategyStateRow[] {
    const rows = this.db.prepare('SELECT * FROM strategy_state').all() as unknown as {
      id: string
      status: StrategyStatus
      params: string
      createdAt: number
      lastSignal: number
    }[]
    return rows.map((r) => ({ ...r, params: JSON.parse(r.params) as StrategyParam[] }))
  }
  upsertStrategyState(s: StrategyStateRow): void {
    this.db
      .prepare(
        `INSERT INTO strategy_state(id,status,params,createdAt,lastSignal) VALUES (?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, params=excluded.params, lastSignal=excluded.lastSignal`,
      )
      .run(s.id, s.status, JSON.stringify(s.params), s.createdAt, s.lastSignal)
  }
  setStrategyStatus(id: string, status: StrategyStatus): void {
    this.db.prepare('UPDATE strategy_state SET status = ? WHERE id = ?').run(status, id)
  }
  setStrategyParams(id: string, params: StrategyParam[]): void {
    this.db
      .prepare('UPDATE strategy_state SET params = ?, lastSignal = ? WHERE id = ?')
      .run(JSON.stringify(params), Date.now(), id)
  }

  // --- metrics history (persisted summary numbers over time) ---------------
  insertMetric(t: number, payload: unknown): void {
    this.db
      .prepare('INSERT INTO metrics(t,json) VALUES(?,?) ON CONFLICT(t) DO UPDATE SET json=excluded.json')
      .run(t, JSON.stringify(payload))
  }
  metrics(limit = 720): { t: number; json: string }[] {
    const rows = this.db
      .prepare('SELECT * FROM metrics ORDER BY t DESC LIMIT ?')
      .all(limit) as unknown as { t: number; json: string }[]
    return rows.reverse()
  }

  /** Wipe all trading state (keeps schema). Used by reset. */
  reset(): void {
    for (const t of ['positions', 'orders', 'trades', 'activity', 'alerts', 'equity_points', 'metrics', 'kv']) {
      this.db.exec(`DELETE FROM ${t}`)
    }
  }
}
