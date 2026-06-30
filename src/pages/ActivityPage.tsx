import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useBotStore } from '@/store/useBotStore'
import type { ActivityLevel } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/dashboard/widgets'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { Input, Select } from '@/components/ui'

const LEVELS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All events' },
  { value: 'trade', label: 'Trades' },
  { value: 'signal', label: 'Signals' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warnings' },
  { value: 'error', label: 'Errors' },
  { value: 'info', label: 'System' },
]

export function ActivityPage() {
  const activity = useBotStore((s) => s.activity)
  const [level, setLevel] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activity.filter(
      (e) =>
        (level === 'all' || e.level === (level as ActivityLevel)) &&
        (!q || e.message.toLowerCase().includes(q) || (e.detail ?? '').toLowerCase().includes(q)),
    )
  }, [activity, level, query])

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Live, append-only stream of every order, fill, signal and system event."
      />

      <SectionCard
        title={`${filtered.length} events`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                leftIcon={<Search size={14} />}
                className="h-8 text-xs"
              />
            </div>
            <Select value={level} onChange={(e) => setLevel(e.target.value)} className="h-8 w-auto text-xs">
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        }
        bodyClassName="p-2.5"
      >
        <ActivityFeed events={filtered} />
      </SectionCard>
    </div>
  )
}
