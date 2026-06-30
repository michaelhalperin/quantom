import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Horizontal-scroll wrapper so wide tables stay usable on small screens. */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  )
}

export function Th({ className, children, align = 'left', ...props }: ComponentProps<'th'> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'sticky top-0 bg-surface px-3 py-2.5 text-[11px] font-medium tracking-wide text-muted-2 uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function SortTh({
  label,
  active,
  dir,
  onClick,
  align = 'left',
  className,
}: {
  label: ReactNode
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <Th align={align} className={cn('cursor-pointer select-none transition-colors hover:text-muted', className)}>
      <span
        onClick={onClick}
        className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}
      >
        {label}
        <span className={cn('text-[9px] transition-opacity', active ? 'opacity-100 text-primary' : 'opacity-30')}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
      </span>
    </Th>
  )
}

export function Td({ className, children, align = 'left', ...props }: ComponentProps<'td'> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 text-[13px] text-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
