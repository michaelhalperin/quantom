import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ----------------------------------- Card --------------------------------- */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 px-5 pt-4 pb-3', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-[13px] font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

/* ---------------------------------- Button -------------------------------- */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-sm shadow-primary/30',
  secondary: 'bg-surface-2 text-foreground border border-border hover:bg-surface-3',
  outline: 'border border-border text-foreground hover:bg-surface-2',
  ghost: 'text-muted hover:text-foreground hover:bg-surface-2',
  danger: 'bg-loss/12 text-loss border border-loss/20 hover:bg-loss/20',
  success: 'bg-profit/12 text-profit border border-profit/20 hover:bg-profit/20',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium whitespace-nowrap transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  )
}

/* ----------------------------------- Badge -------------------------------- */
type BadgeVariant =
  | 'default'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'muted'
  | 'outline'
  | 'primary'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-foreground border border-border',
  success: 'bg-profit/12 text-profit border border-profit/20',
  danger: 'bg-loss/12 text-loss border border-loss/20',
  warning: 'bg-warning/12 text-warning border border-warning/25',
  info: 'bg-primary/12 text-primary border border-primary/20',
  primary: 'bg-primary text-primary-foreground border border-transparent',
  muted: 'bg-surface-2 text-muted border border-border',
  outline: 'bg-transparent text-muted border border-border',
}

interface BadgeProps extends ComponentProps<'span'> {
  variant?: BadgeVariant
  dot?: boolean
}

export function Badge({ variant = 'default', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* --------------------------------- Skeleton ------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-[length:200%_100%]',
        'bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2',
        className,
      )}
    />
  )
}

/* -------------------------------- ProgressBar ----------------------------- */
export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number
  max?: number
  className?: string
  barClassName?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all duration-500', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ----------------------------------- Delta -------------------------------- */
export function Delta({
  value,
  children,
  className,
  showArrow = true,
}: {
  value: number
  children: ReactNode
  className?: string
  showArrow?: boolean
}) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium tabular-nums',
        dir === 'up' && 'text-profit',
        dir === 'down' && 'text-loss',
        dir === 'flat' && 'text-muted',
        className,
      )}
    >
      {showArrow && dir !== 'flat' && (
        <span className="text-[0.85em]">{dir === 'up' ? '▲' : '▼'}</span>
      )}
      {children}
    </span>
  )
}

/* ---------------------------------- Spinner ------------------------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --------------------------------- EmptyState ----------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-muted-2">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ------------------------------------ Kbd --------------------------------- */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1.5 font-sans text-[10px] font-medium text-muted">
      {children}
    </kbd>
  )
}

/* --------------------------------- Divider -------------------------------- */
export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />
}
