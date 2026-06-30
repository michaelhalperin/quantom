import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', 'config.json')

export interface Config {
  bot: {
    /** Starting virtual bankroll (USDC). */
    initialCapital: number
    /** 'paper' is the only executable mode. 'live' is refused by design. */
    mode: 'paper'
    /** Seconds between trading cycles (scan → decide → trade → manage). */
    cycleSeconds: number
    /** Seconds between lightweight market-price refreshes. */
    refreshSeconds: number
    /** Start the trading loop on boot. */
    autoStart: boolean
  }
  risk: {
    /** Max share of equity in a single new position (cost basis). */
    maxFractionPerTrade: number
    /** Max share of equity deployed across all positions. */
    maxGrossExposure: number
    /** Max share of equity in any one market category. */
    maxFractionPerCategory: number
    /** Multiplier on full-Kelly sizing (0.25 = quarter-Kelly, conservative). */
    kellyFraction: number
    /** Pause everything if day P&L drops below -this percent of equity. */
    dailyLossLimitPct: number
    /** Auto-trigger the kill switch on a daily-loss breach. */
    autoKillSwitch: boolean
    /** Exit a winning value position at +this fraction of cost. */
    takeProfit: number
    /** Exit a losing value position at -this fraction of cost. */
    stopLoss: number
    /** Taker fee applied to paper fills, in basis points (Polymarket ~0 today). */
    feeBps: number
  }
  strategy: {
    enableArbitrage: boolean
    /** Minimum locked-in profit per $1 YES/NO pair to take an arb (after fees). */
    arbMinProfit: number
    enableValue: boolean
    /** Market must disagree with our fair value by at least this (probability). */
    valueMinEdge: number
    /** History points used to compute the value model's reference fair price. */
    valueLookback: number
    /** Reserved: classic market-making (off; no proven edge in paper). */
    enableMarketMaking: boolean
  }
  universe: {
    /** Ignore markets below this CLOB liquidity. */
    minLiquidity: number
    /** Ignore markets below this 24h volume. */
    minVolume24h: number
    /** Max markets to track/serve. */
    maxMarkets: number
  }
}

export const DEFAULT_CONFIG: Config = {
  bot: {
    initialCapital: Number(process.env.INITIAL_CAPITAL ?? 25_000),
    mode: 'paper',
    cycleSeconds: 25,
    refreshSeconds: 6,
    autoStart: String(process.env.AUTO_START ?? 'false') === 'true',
  },
  risk: {
    maxFractionPerTrade: 0.05,
    maxGrossExposure: 0.7,
    maxFractionPerCategory: 0.35,
    kellyFraction: 0.25,
    dailyLossLimitPct: 5,
    autoKillSwitch: true,
    takeProfit: 0.25,
    stopLoss: 0.2,
    feeBps: 0,
  },
  strategy: {
    enableArbitrage: true,
    arbMinProfit: 0.01,
    enableValue: true,
    valueMinEdge: 0.06,
    valueLookback: 20,
    enableMarketMaking: false,
  },
  universe: {
    minLiquidity: 20_000,
    minVolume24h: 5_000,
    maxMarkets: 60,
  },
}

/** Deep-merge persisted config over defaults so new keys always have a value. */
function merge(base: Config, over: Partial<Config>): Config {
  return {
    bot: { ...base.bot, ...over.bot },
    risk: { ...base.risk, ...over.risk },
    strategy: { ...base.strategy, ...over.strategy },
    universe: { ...base.universe, ...over.universe },
  }
}

let current: Config = DEFAULT_CONFIG

export function loadConfig(): Config {
  if (existsSync(CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<Config>
      current = merge(DEFAULT_CONFIG, parsed)
    } catch {
      current = DEFAULT_CONFIG
    }
  } else {
    current = DEFAULT_CONFIG
    saveConfig(current)
  }
  // mode is always paper, regardless of what's on disk.
  current.bot.mode = 'paper'
  return current
}

export function getConfig(): Config {
  return current
}

export function saveConfig(cfg: Config): void {
  current = cfg
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
  } catch {
    /* best-effort persistence */
  }
}

/** Shallow-patch a config section and persist. */
export function patchConfig(patch: Partial<Config>): Config {
  saveConfig(merge(current, patch))
  return current
}
