import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes with conditional logic, de-duping conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}

export function randomId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** Deterministic PRNG (mulberry32) so seeded mock data is stable across reloads. */
export function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random float in [min, max). */
export function randFloat(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min)
}

/** Random int in [min, max] inclusive. */
export function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(randFloat(rng, min, max + 1))
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Box-Muller transform → normally distributed value. */
export function gaussian(rng: () => number, mean = 0, stdev = 1) {
  const u = 1 - rng()
  const v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return z * stdev + mean
}

export function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0)
}

export function mean(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0
}

export function stddev(arr: number[]) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)))
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
