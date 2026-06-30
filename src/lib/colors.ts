import type { MarketCategory } from '@/types'
import { MARKET_CATEGORIES } from '@/types'

export const CHART_COLORS = [
  '#4d7cff',
  '#16c784',
  '#f5a623',
  '#9b7dff',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#84cc16',
]

export function categoryColor(cat: MarketCategory) {
  const i = MARKET_CATEGORIES.indexOf(cat)
  return CHART_COLORS[(i < 0 ? 0 : i) % CHART_COLORS.length]
}
