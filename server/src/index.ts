import { DB } from './db'
import { MarketCache } from './markets'
import { Broker } from './engine/broker'
import { Bot } from './engine/bot'
import { createServer } from './http'
import { loadConfig, getConfig } from './config'
import { log } from './log'

async function main() {
  const cfg = loadConfig()
  const db = new DB()

  // Seed the paper bankroll on first run.
  if (db.getKv('balance') === null) db.setNum('balance', cfg.bot.initialCapital)

  const cache = new MarketCache()
  const broker = new Broker(db, cache)
  const bot = new Bot(db, cache, broker)

  log.info('starting Polymarket paper-trading backend…')
  await bot.boot()

  const port = Number(process.env.PORT ?? 8787)
  const server = createServer({ db, cache, broker, bot })
  server.listen(port, () => {
    log.info(`API listening on http://localhost:${port}`)
    log.info(`  • GET  /api/snapshot   full dashboard state`)
    log.info(`  • GET  /api/book/:id   live order book`)
    log.info(`mode=paper · bankroll=$${getConfig().bot.initialCapital.toLocaleString()} · online=${bot.isOnline()}`)
    log.info(`point the dashboard at it with VITE_BOT_API=http://localhost:${port}/api`)
  })

  const shutdown = () => {
    log.info('shutting down…')
    bot.stopTimers()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  log.error('fatal', err)
  process.exit(1)
})
