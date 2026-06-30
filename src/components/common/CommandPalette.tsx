import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Cpu, Power, Search, Sun } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { useBotStore } from '@/store/useBotStore'
import { NAV } from '@/lib/nav'
import { formatCents } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui'

interface CommandOption {
  id: string
  label: string
  group: 'Pages' | 'Markets' | 'Strategies' | 'Actions'
  icon: ReactNode
  hint?: string
  perform: () => void
}

const GROUP_ORDER: CommandOption['group'][] = ['Pages', 'Markets', 'Strategies', 'Actions']

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const navigate = useNavigate()
  const markets = useBotStore((s) => s.markets)
  const strategies = useBotStore((s) => s.strategies)
  const toggleOnline = useBotStore((s) => s.toggleBotOnline)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const id = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(id)
    }
  }, [open])

  const options = useMemo<CommandOption[]>(() => {
    const go = (to: string) => () => {
      navigate(to)
      setOpen(false)
    }
    return [
      ...NAV.map((n) => {
        const Icon = n.icon
        return {
          id: `nav-${n.to}`,
          label: n.label,
          group: 'Pages' as const,
          icon: <Icon size={16} />,
          perform: go(n.to),
        }
      }),
      ...markets.map((m) => ({
        id: `mkt-${m.id}`,
        label: m.question,
        group: 'Markets' as const,
        icon: <span className="text-sm">{m.icon}</span>,
        hint: formatCents(m.yesPrice),
        perform: go(`/markets/${m.id}`),
      })),
      ...strategies.map((s) => ({
        id: `strat-${s.id}`,
        label: s.name,
        group: 'Strategies' as const,
        icon: <Cpu size={16} />,
        perform: go('/strategies'),
      })),
      {
        id: 'act-theme',
        label: 'Toggle light / dark theme',
        group: 'Actions' as const,
        icon: <Sun size={16} />,
        perform: () => toggleTheme(),
      },
      {
        id: 'act-bot',
        label: 'Pause / resume bot',
        group: 'Actions' as const,
        icon: <Power size={16} />,
        perform: () => {
          toggleOnline()
          setOpen(false)
        },
      },
    ]
  }, [markets, strategies, navigate, setOpen, toggleTheme, toggleOnline])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
      : options
    return [...list].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
  }, [query, options])

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[active]?.perform()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  let runningIndex = -1

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.16 }}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={17} className="text-muted-2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                placeholder="Search markets, pages, strategies, actions…"
                className="h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-muted">No results found.</div>
              )}
              {GROUP_ORDER.map((group) => {
                const groupItems = filtered.filter((o) => o.group === group)
                if (!groupItems.length) return null
                return (
                  <div key={group} className="mb-1">
                    <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-2 uppercase">
                      {group}
                    </div>
                    {groupItems.map((o) => {
                      runningIndex += 1
                      const idx = runningIndex
                      const isActive = idx === active
                      return (
                        <button
                          key={o.id}
                          data-idx={idx}
                          type="button"
                          onMouseMove={() => setActive(idx)}
                          onClick={() => o.perform()}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
                            isActive ? 'bg-primary/12 text-foreground' : 'text-muted hover:bg-surface-2',
                          )}
                        >
                          <span className={cn('flex shrink-0', isActive ? 'text-primary' : 'text-muted-2')}>
                            {o.icon}
                          </span>
                          <span className="flex-1 truncate">{o.label}</span>
                          {o.hint && <span className="text-xs text-muted-2 tabular-nums">{o.hint}</span>}
                          {isActive && <CornerDownLeft size={14} className="text-muted-2" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
