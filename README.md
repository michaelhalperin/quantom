# Quantum — Polymarket Bot Dashboard

A complete, production-quality control center for a Polymarket trading bot. Built with
**React 19 + Vite + TypeScript + Tailwind v4**. Frontend only — it ships with a realistic,
live-updating simulated data feed that you swap for your real bot API in one file.

![stack](https://img.shields.io/badge/React-19-61dafb) ![stack](https://img.shields.io/badge/Vite-8-646cff) ![stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![stack](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## Features

- **Overview** — equity curve, KPIs (equity, P&L, day P&L, exposure, win rate), allocation
  donut, top positions, live activity, strategy P&L, risk limits and top movers.
- **Positions** — live mark-to-market table with sorting, filtering and one-click close.
- **Markets** — searchable, filterable grid of Polymarket markets with sparklines & stats.
- **Market detail** — price chart (multi-timeframe), order book, market-depth chart,
  a working buy/sell **order ticket**, recent trades and your positions in that market.
- **Orders** — working/partial orders with fill progress and cancel.
- **Trade history** — full fill-by-fill log with search, filters, pagination and CSV action.
- **Strategies** — per-strategy cards with live equity sparklines, stats, pause/resume/stop,
  and a **parameter configurator** (sliders) per strategy.
- **Analytics** — daily P&L, drawdown, win/loss donut, Sharpe/Sortino/profit factor/expectancy,
  P&L by category, and a day-×-hour P&L **heatmap**.
- **Risk** — alerts (ack/dismiss), exposure limits with gauges, kill-switch controls,
  exposure by category.
- **Activity** — append-only, filterable event stream.
- **Settings** — connection, trading defaults, risk guards, notifications and theme.
- **Extras** — ⌘K command palette, live market ticker, toasts, dark/light themes,
  fully responsive layout (collapsible sidebar + mobile drawer), animated number counters,
  flashing live prices, and route-level code splitting.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build
```

## The live backend

A real paper-trading backend lives in **[`server/`](./server)**. It reads live, public
Polymarket data, runs an actual trading loop, and serves this dashboard the exact shapes it
expects — so every page goes live with real markets, real order books, and a real equity curve
driven by real (simulated-money) fills. It never touches a wallet or real money.

```bash
# terminal 1 — backend (boots paused, $25k virtual bankroll)
cd server && npm install && npm start      # → http://localhost:8787

# terminal 2 — dashboard
npm install && npm run dev                 # → http://localhost:5173
```

The dashboard is wired to the backend through one boundary — **`src/data/api.ts`** — selected by
the `VITE_BOT_API` env var in **`.env.local`** (already created). With it set, `getSnapshot()`,
`getOrderBook()`, and every store action (`placeOrder`, `closePosition`, `cancelOrder`,
`toggleStrategy`, …) call the backend, and `useSimulation` polls the live snapshot instead of
running the built-in simulation. **Delete `.env.local`** to fall back to the standalone demo
data — no backend required.

See **[server/README.md](./server/README.md)** for strategies, risk controls, configuration, the
HTTP API, and the honest reality check on what a trading bot can and can't do.

## Project structure

```
src/
  types/         Domain model (Market, Position, Order, Trade, Strategy, …)
  data/          mock.ts (data generators) · api.ts (THE swap point)
  store/          useBotStore (live state + actions) · useUIStore (theme, toasts, ⌘K)
  hooks/          useSimulation, useCountUp, useFlash, useMediaQuery, useSort
  lib/            utils, formatters, nav config, colors
  components/
    ui/           Card, Button, Badge, Input, Select, Switch, Slider, Tabs,
                  Modal, Tooltip, Dropdown, Sparkline, …
    charts/       Equity, P&L, Drawdown, Price, Depth, Donut, BarList, Heatmap
    layout/       Sidebar, Topbar, AppLayout, PageHeader
    common/       CommandPalette, Toaster, MarketTicker, badges, status
    dashboard/    KpiCard, StatTile, SectionCard, LiveNumber
    markets/ positions/ orders/ trades/ strategies/ activity/
  pages/          One file per route
```

## Notes

- Money values are USD; prices are probabilities in `[0, 1]` (shown as cents / %).
- Mock data is seeded so it's stable across reloads, then drifts live while the bot is "online".
- Not financial advice. Demo data only until wired to your bot.
