import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import { MARKET_CATEGORIES } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { MarketCard } from '@/components/markets/MarketCard'
import { EmptyState, Input, Select, Switch } from '@/components/ui'
import { cn } from '@/lib/utils'

const SORTS = {
  volume24h: 'Volume (24h)',
  liquidity: 'Liquidity',
  change: '24h move',
  yesPrice: 'YES price',
  endDate: 'Ending soon',
} as const
type SortKey = keyof typeof SORTS

export function MarketsPage() {
  const markets = useBotStore((s) => s.markets)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<SortKey>('volume24h')
  const [botOnly, setBotOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = markets.filter(
      (m) =>
        (!q || m.question.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q))) &&
        (category === 'All' || m.category === category) &&
        (!botOnly || m.botActive),
    )
    return list.sort((a, b) => {
      if (sort === 'change') return Math.abs(b.change24h) - Math.abs(a.change24h)
      if (sort === 'endDate') return a.endDate - b.endDate
      return (b[sort] as number) - (a[sort] as number)
    })
  }, [markets, query, category, sort, botOnly])

  return (
    <div>
      <PageHeader
        title="Markets"
        description={`Browse ${markets.length} Polymarket markets the bot tracks. Click any market to trade or inspect.`}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-80">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets or tags…"
            leftIcon={<Search size={15} />}
          />
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                Sort: {label}
              </option>
            ))}
          </Select>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-muted">
            <Switch checked={botOnly} onCheckedChange={setBotOnly} size="sm" />
            Bot active only
          </label>
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {['All', ...MARKET_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
              category === c
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <CardLike />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function CardLike() {
  return (
    <div className="mt-4">
      <EmptyState title="No markets match" description="Try a different search or category." />
    </div>
  )
}
