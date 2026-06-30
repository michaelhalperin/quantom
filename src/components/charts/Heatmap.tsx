import type { HeatCell } from '@/types'
import { range } from '@/lib/utils'
import { formatSignedCurrency } from '@/lib/format'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Heatmap({ data }: { data: HeatCell[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.pnl)), 1)
  const map = new Map(data.map((d) => [`${d.day}-${d.hour}`, d]))

  const cellColor = (pnl: number) => {
    if (pnl === 0) return 'var(--surface-2)'
    const intensity = 18 + Math.min(1, Math.abs(pnl) / max) * 70
    const base = pnl > 0 ? 'var(--profit)' : 'var(--loss)'
    return `color-mix(in srgb, ${base} ${intensity.toFixed(0)}%, transparent)`
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[660px]">
        <div className="mb-1 flex items-center gap-0.5 pl-10">
          {range(24).map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-2">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DAYS.map((day, di) => (
          <div key={day} className="mb-0.5 flex items-center gap-0.5">
            <div className="w-10 shrink-0 text-[10px] text-muted">{day}</div>
            {range(24).map((h) => {
              const d = map.get(`${di}-${h}`)
              const pnl = d?.pnl ?? 0
              const trades = d?.trades ?? 0
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 · ${trades} trades · ${formatSignedCurrency(pnl, 0)}`}
                  className="h-5 flex-1 rounded-[3px] border border-border/40 transition-transform hover:scale-110"
                  style={{ background: cellColor(pnl) }}
                />
              )
            })}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-1.5 pr-1 text-[10px] text-muted-2">
          <span>Loss</span>
          <span className="h-3 w-4 rounded-sm" style={{ background: 'color-mix(in srgb, var(--loss) 70%, transparent)' }} />
          <span className="h-3 w-4 rounded-sm" style={{ background: 'var(--surface-2)' }} />
          <span className="h-3 w-4 rounded-sm" style={{ background: 'color-mix(in srgb, var(--profit) 70%, transparent)' }} />
          <span>Profit</span>
        </div>
      </div>
    </div>
  )
}
