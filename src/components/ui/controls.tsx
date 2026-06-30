import type { ComponentProps, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ----------------------------------- Input -------------------------------- */
interface InputProps extends ComponentProps<'input'> {
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export function Input({ className, leftIcon, rightSlot, ...props }: InputProps) {
  return (
    <div className="relative flex items-center">
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 flex text-muted-2">{leftIcon}</span>
      )}
      <input
        className={cn(
          'h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted-2',
          'transition-colors focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/40',
          leftIcon && 'pl-9',
          rightSlot && 'pr-10',
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <span className="absolute right-3 flex text-xs text-muted-2">{rightSlot}</span>
      )}
    </div>
  )
}

/* ----------------------------------- Select ------------------------------- */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-9 w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface-2 pl-3 pr-9 text-[13px] text-foreground',
          'transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/40',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-2"
      />
    </div>
  )
}

/* ----------------------------------- Switch ------------------------------- */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  size = 'md',
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const dims =
    size === 'sm'
      ? { track: 'h-4 w-7', knob: 'h-3 w-3', on: 'translate-x-3' }
      : { track: 'h-5 w-9', knob: 'h-4 w-4', on: 'translate-x-4' }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        dims.track,
        checked ? 'bg-primary' : 'bg-surface-3',
      )}
    >
      <span
        className={cn(
          'inline-block translate-x-0.5 rounded-full bg-white shadow transition-transform',
          dims.knob,
          checked && dims.on,
        )}
      />
    </button>
  )
}

/* ----------------------------------- Slider ------------------------------- */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  className?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full accent-primary outline-none',
        className,
      )}
      style={{
        background: `linear-gradient(to right, var(--primary) ${pct}%, var(--surface-3) ${pct}%)`,
      }}
    />
  )
}

/* ------------------------------ SegmentedControl -------------------------- */
export interface SegOption<T extends string> {
  label: ReactNode
  value: T
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 font-medium transition-all',
            size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-xs',
            value === o.value
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------ Tabs -------------------------------- */
export interface TabItem<T extends string> {
  label: string
  value: T
  count?: number
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-border no-scrollbar', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
            value === t.value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                value === t.value ? 'bg-primary/15 text-primary' : 'bg-surface-2 text-muted',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
