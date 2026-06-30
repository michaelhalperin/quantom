// Tiny leveled logger. Keeps the console readable and timestamps everything.

type Level = 'debug' | 'info' | 'warn' | 'error'

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
}
const RESET = '\x1b[0m'

const ENABLE_DEBUG = process.env.LOG_LEVEL === 'debug'

function emit(level: Level, msg: string, extra?: unknown): void {
  if (level === 'debug' && !ENABLE_DEBUG) return
  const ts = new Date().toISOString().slice(11, 19)
  const tag = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`
  if (extra !== undefined) console.log(`${ts} ${tag} ${msg}`, extra)
  else console.log(`${ts} ${tag} ${msg}`)
}

export const log = {
  debug: (m: string, e?: unknown) => emit('debug', m, e),
  info: (m: string, e?: unknown) => emit('info', m, e),
  warn: (m: string, e?: unknown) => emit('warn', m, e),
  error: (m: string, e?: unknown) => emit('error', m, e),
}
