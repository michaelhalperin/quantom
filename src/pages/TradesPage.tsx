import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { MARKET_CATEGORIES } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard, StatTile } from '@/components/dashboard/widgets'
import { TradesTable } from '@/components/trades/TradesTable'
import { Button, Card, Input, Select, Switch } from '@/components/ui'
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  pnlColor,
} from '@/lib/format'

export function TradesPage() {
  const trades = useBotStore((s) => s.trades)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [side, setSide] = useState('all')
  const [outcome, setOutcome] = useState('all')
  const [realizedOnly, setRealizedOnly] = useState(false)
  const [visible, setVisible] = useState(30)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return trades.filter(
      (t) =>
        (!q || t.question.toLowerCase().includes(q)) &&
        (category === 'all' || t.category === category) &&
        (side === 'all' || t.side === side) &&
        (outcome === 'all' || t.outcome === outcome) &&
        (!realizedOnly || t.realized),
    )
  }, [trades, query, category, side, outcome, realizedOnly])

  const realized = filtered.filter((t) => t.pnl !== null)
  const pnl = realized.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const wins = realized.filter((t) => (t.pnl ?? 0) > 0).length
  const fees = filtered.reduce((s, t) => s + t.fee, 0)
  const volume = filtered.reduce((s, t) => s + t.value, 0)

  return (
    <div>
      <PageHeader
        title="Trade History"
        description="Complete fill-by-fill record across every strategy."
        actions={
          <Button variant="secondary" size="sm">
            <Download size={15} />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Trades" value={filtered.length} />
        <StatTile label="Volume" value={formatCurrency(volume, 0)} />
        <StatTile label="Realized P&L" value={formatSignedCurrency(pnl, 0)} valueClass={pnlColor(pnl)} />
        <StatTile
          label="Win rate"
          value={realized.length ? formatPercent(wins / realized.length, 0) : '—'}
          sub={`${wins}/${realized.length}`}
        />
        <StatTile label="Fees" value={formatCurrency(fees)} />
      </div>

      <Card className="mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="lg:w-72">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets…"
            leftIcon={<Search size={15} />}
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
            <option value="all">All categories</option>
            {MARKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={side} onChange={(e) => setSide(e.target.value)} className="w-auto">
            <option value="all">Buy & Sell</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </Select>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-auto">
            <option value="all">YES & NO</option>
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </Select>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-muted">
            <Switch checked={realizedOnly} onCheckedChange={setRealizedOnly} size="sm" />
            Realized only
          </label>
        </div>
      </Card>

      <div className="mt-4">
        <SectionCard bodyClassName="p-0">
          <TradesTable trades={filtered.slice(0, visible)} />
          {filtered.length > visible && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + 30)}>
                Show more ({filtered.length - visible})
              </Button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
