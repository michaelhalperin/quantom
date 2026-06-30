import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { OrderBook, PricePoint } from '@/types'
import { formatCents, formatCompact } from '@/lib/format'
import { ChartTooltip } from './common'

const axisTick = { fontSize: 11, fill: 'var(--muted-2)' }

export function PriceChart({
  data,
  height = 300,
  color,
  showAxis = true,
}: {
  data: PricePoint[]
  height?: number
  color?: string
  showAxis?: boolean
}) {
  const id = useId()
  const up = data.length > 1 && data[data.length - 1].p >= data[0].p
  const stroke = color ?? (up ? 'var(--profit)' : 'var(--loss)')

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`price-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(t) => format(Number(t), 'MMM d')}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
          hide={!showAxis}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={40}
          hide={!showAxis}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltip
              labelFormatter={(t) => format(Number(t), 'MMM d, yyyy')}
              formatter={(v) => formatCents(v)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="p"
          name="YES"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#price-${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DepthChart({ book, height = 240 }: { book: OrderBook; height?: number }) {
  const id = useId()
  const bids = [...book.bids]
    .map((l) => ({ price: l.price, bid: l.total }))
    .reverse()
  const asks = book.asks.map((l) => ({ price: l.price, ask: l.total }))
  const data = [...bids, ...asks]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`bid-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--profit)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--profit)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`ask-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--loss)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="price"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => `${Math.round(Number(v) * 100)}¢`}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v))}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <ReferenceLine x={book.midpoint} stroke="var(--border-strong)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltip
              labelFormatter={(p) => `${(Number(p) * 100).toFixed(1)}¢`}
              formatter={(v) => `${formatCompact(v)} sh`}
            />
          }
        />
        <Area
          type="stepAfter"
          dataKey="bid"
          name="Bids"
          stroke="var(--profit)"
          strokeWidth={1.5}
          fill={`url(#bid-${id})`}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Area
          type="stepBefore"
          dataKey="ask"
          name="Asks"
          stroke="var(--loss)"
          strokeWidth={1.5}
          fill={`url(#ask-${id})`}
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
