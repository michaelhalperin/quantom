# Quantum Backend — Polymarket paper-trading engine

This is the **backend** that powers the dashboard in the parent folder. It reads
**live, public Polymarket data**, runs an actual trading loop (scan → find an
edge → size → execute → manage), and serves the dashboard the exact data shapes
it expects. Every page goes live — real markets, real order books, a real
equity curve driven by real fills.

It trades in **paper mode**: a virtual bankroll, simulated fills against the
*real* order book (so slippage and fees are realistic), and **no wallet, no
private keys, no real money.** Nothing here can spend a cent.

> ### Reality check — please read
> No bot can *guarantee* profit on Polymarket. It's a competitive, real-money
> market and the easy edges are already arbitraged away. The point of this
> backend is to find out **safely** whether a strategy has a real edge — by
> trading it on live prices with fake money and measuring the result over many
> resolved markets — *before* anyone risks anything real. Treat early numbers as
> an experiment, not a promise. Real-money trading is intentionally **disabled**
> (see *Going live*, last section).

---

## Quick start

Two processes: the backend (this folder) and the dashboard (parent folder).

**1 — Start the backend**

```bash
cd server
npm install
npm start          # → http://localhost:8787
```

It boots **paused** with a $25,000 virtual bankroll. Nothing trades until you
press **Start** in the dashboard (or set `AUTO_START=true`).

**2 — Start the dashboard** (in a second terminal)

```bash
cd ..              # the dashboard root
npm install
npm run dev        # → http://localhost:5173
```

The dashboard is already pointed at the backend via `../.env.local`
(`VITE_BOT_API=http://localhost:8787/api`). Open
**http://localhost:5173**, press **Start**, and watch it trade.

> Delete `../.env.local` to run the dashboard on its old built-in demo data
> instead (no backend needed).

Requirements: **Node 22+** (uses the built-in `node:sqlite` and `fetch`). No
database server, no API keys, no account.

---

## What it does each cycle

- **Refresh** (every ~6s): pull the most active markets from Polymarket's Gamma
  API, map them to the dashboard model, and accumulate real price history.
- **Manage** (every refresh, when running): settle markets that have resolved
  (winning shares pay $1, losers $0), fill any resting limit orders the market
  has traded through, and apply take-profit / stop-loss to value positions.
- **Trade** (every ~25s, when running): scan for edges and paper-execute the
  best few, within the risk limits.

## Strategies

| Strategy | Kind | Edge? |
|---|---|---|
| **Arb Scout** | arbitrage | **Real.** In a Yes/No market one YES + one NO always pay exactly $1 at resolution. When both sides can be bought for *less than $1* (after fees), the profit is locked in. Genuinely riskless — but rare, since books are usually tight. |
| **Mean Reversion** | mean-reversion | **Unproven.** Fades short-term moves away from a rolling reference price. This has *no proven long-run edge*; it exists to be **measured** in paper, conservatively sized. If it doesn't make money over 100+ resolved markets, that's the answer — turn it off. |

Both appear on the dashboard's **Strategies** page where you can pause/resume
them and tune their parameters (which feed straight back into the engine).

## Risk controls (all enforced before any fill)

- **Fractional Kelly** sizing (default quarter-Kelly) — bet bigger only with a
  bigger edge, never aggressively.
- **Per-trade cap** (default 5% of equity), **gross-exposure cap** (70%), and a
  **per-category cap** (35%) so it can't pile into one theme.
- **Daily-loss kill switch** (default −5%): breaches pause every strategy and
  raise a critical alert.
- Take-profit / stop-loss on value positions; arbitrage pairs are held to
  resolution (that's where their locked profit is realised).

---

## Configuration — `config.json`

Auto-created on first run with sensible defaults; edit and restart, or change
most of it live from the dashboard's strategy sliders. Highlights:

| Key | Meaning | Default |
|---|---|---|
| `bot.initialCapital` | Starting virtual bankroll (USDC) | 25000 |
| `bot.autoStart` | Start the trading loop on boot | false |
| `bot.cycleSeconds` / `refreshSeconds` | Trade cadence / price-refresh cadence | 25 / 6 |
| `risk.maxFractionPerTrade` | Max equity in one position | 0.05 |
| `risk.maxGrossExposure` | Max equity deployed at once | 0.70 |
| `risk.maxFractionPerCategory` | Max equity in one category | 0.35 |
| `risk.kellyFraction` | Sizing aggressiveness (0.25 = quarter-Kelly) | 0.25 |
| `risk.dailyLossLimitPct` | Kill-switch threshold | 5 |
| `risk.takeProfit` / `stopLoss` | Value-position exits | 0.25 / 0.20 |
| `strategy.enableArbitrage` / `arbMinProfit` | Arb on/off, min locked profit | true / 0.01 |
| `strategy.enableValue` / `valueMinEdge` | Value on/off, min edge to act (prob.) | true / 0.06 |
| `universe.minLiquidity` / `minVolume24h` / `maxMarkets` | What counts as tradeable | 20000 / 5000 / 60 |

Environment overrides (optional, see `.env.example`): `PORT`,
`INITIAL_CAPITAL`, `AUTO_START`, `CORS_ORIGIN`.

## HTTP API

```
GET  /api/health                      liveness
GET  /api/snapshot                    full dashboard state (the contract)
GET  /api/book/:marketId              live order book
POST /api/orders                      place a manual order  {marketId,outcome,side,type,price,size}
POST /api/orders/:id/cancel           cancel a resting order
POST /api/positions/:id/close         close a position at market
POST /api/strategies/:id/toggle       pause/resume
POST /api/strategies/:id/status       {status}
POST /api/strategies/:id/params       {key,value}
POST /api/alerts/:id/ack              acknowledge · POST /api/alerts/:id dismisses
POST /api/bot/online                  {online} start/stop the trading loop
POST /api/bot/mode                    {mode} — 'live' is refused by design
POST /api/settings                    patch config
POST /api/reset                       wipe paper history, restart at initial capital
```

## Data & persistence

State lives in `data/polybot.db` (SQLite). Stop and restart any time without
losing positions, trades, or the equity curve — leave it running for days and
the longer it runs, the more markets resolve and the more you learn. To start
over: `POST /api/reset`, or delete the file.

## How it's built

```
src/
  index.ts            entry — wires everything, boots the loop + HTTP server
  config.ts           defaults + config.json load/save
  db.ts               node:sqlite schema + typed repositories
  markets.ts          live market cache + rolling/backfilled price history
  portfolio.ts        mark positions to market (shared by loop + snapshot)
  snapshot.ts         assemble the dashboard's full state object
  http.ts             zero-dependency router (node:http)
  polymarket/
    client.ts         Gamma + CLOB fetchers (timeout, retry, health)
    map.ts            Polymarket shapes → dashboard Market/OrderBook
  engine/
    broker.ts         paper broker: walk-the-book fills, fees, settlement
    risk.ts           Kelly sizing, exposure caps, kill switch, risk gauges
    strategies.ts     arbitrage + mean-reversion signals
    bot.ts            the scan → decide → trade → manage loop
```

Type-checked against the dashboard's own `../src/types`, so the API can't drift
from what the UI expects. Run `npm run typecheck` to verify.

---

## Going live (intentionally **not** enabled)

Real-money execution is deliberately off. `mode: live` is refused everywhere,
and the only broker implementation is the paper one. Turning it on later would
mean writing a *live* execution layer using Polymarket's authenticated CLOB
client (`@polymarket/clob-client`), which needs a funded Polygon wallet and API
credentials — and it should only be considered **after** paper trading has shown
a real, positive edge across **100+ resolved markets**. The strategy, risk, and
accounting code is structured so only the execution layer changes. Until then:
paper only, on purpose.
