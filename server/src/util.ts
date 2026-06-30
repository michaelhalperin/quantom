// Small dependency-free helpers: math, ids, time.

export const DAY = 86_400_000
export const HOUR = 3_600_000

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

export function round(n: number, d = 2): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** d
  return Math.round(n * f) / f
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

export function mean(arr: number[]): number {
  return arr.length ? sum(arr) / arr.length : 0
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)))
}

let _seq = 0
/** Monotonic, collision-resistant id. */
export function id(prefix = 'id'): string {
  _seq = (_seq + 1) & 0xffffff
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/**
 * Kelly fraction of bankroll to put at risk on a binary "buy a share at `price`
 * that pays 1 if our side wins with probability `fair`". Returns a value in
 * [0, 1]; 0 when there is no edge. Derivation: f* = (fair - price) / (1 - price).
 */
export function kellyFraction(fair: number, price: number): number {
  if (price <= 0 || price >= 1) return 0
  const f = (fair - price) / (1 - price)
  return f > 0 ? f : 0
}

/** Run async tasks with a bounded concurrency pool. Preserves input order. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

export const nowIso = () => new Date().toISOString()
