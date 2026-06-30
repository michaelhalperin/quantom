import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { EquityPoint } from '@/types'
import { formatCompact, formatCurrency, formatSignedCurrency } from '@/lib/format'
import { ChartTooltip } from './common'

const axisTick = { fontSize: 11, fill: 'var(--muted-2)' }
const dateAxis = (t: string | number) => format(Number(t), 'MMM d')

export function EquityChart({ data, height = 260 }: { data: EquityPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={dateAxis}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v), true)}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={[(min: number) => Math.floor(min * 0.985), (max: number) => Math.ceil(max * 1.015)]}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltip
              labelFormatter={(t) => format(Number(t), 'MMM d, yyyy')}
              formatter={(v) => formatCurrency(v)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="equity"
          name="Equity"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#eqFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export interface PnLPoint {
  t: number
  value: number
}

export function PnLChart({ data, height = 220 }: { data: PnLPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={dateAxis}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(Number(v), true)}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <ReferenceLine y={0} stroke="var(--border-strong)" />
        <Tooltip
          cursor={{ fill: 'var(--grid)' }}
          content={
            <ChartTooltip
              labelFormatter={(t) => format(Number(t), 'MMM d, yyyy')}
              formatter={(v) => formatSignedCurrency(v)}
            />
          }
        />
        <Bar dataKey="value" name="P&L" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? 'var(--profit)' : 'var(--loss)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DrawdownChart({ data, height = 200 }: { data: EquityPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--loss)" stopOpacity={0} />
            <stop offset="100%" stopColor="var(--loss)" stopOpacity={0.28} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={dateAxis}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }}
          content={
            <ChartTooltip
              labelFormatter={(t) => format(Number(t), 'MMM d, yyyy')}
              formatter={(v) => `${v.toFixed(2)}%`}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          name="Drawdown"
          stroke="var(--loss)"
          strokeWidth={1.5}
          fill="url(#ddFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
