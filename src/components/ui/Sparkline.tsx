import { useId } from 'react'

export function Sparkline({
  data,
  width = 84,
  height = 26,
  strokeWidth = 1.5,
  className,
  color,
  fill = true,
}: {
  data: number[]
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
  color?: string
  fill?: boolean
}) {
  const id = useId()
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = strokeWidth
  const coords = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = pad + (1 - (d - min) / range) * (height - pad * 2)
    return [x, y] as const
  })

  const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${coords[0][0]},${height} ${line} ${coords[coords.length - 1][0]},${height}`
  const up = data[data.length - 1] >= data[0]
  const stroke = color ?? (up ? 'var(--profit)' : 'var(--loss)')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#spark-${id})`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
