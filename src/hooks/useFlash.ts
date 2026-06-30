import { useEffect, useRef, useState } from 'react'

export type FlashDir = 'up' | 'down' | null

/** Returns the direction of the latest change to `value`, briefly, for flashing. */
export function useFlash(value: number, ms = 600): FlashDir {
  const prev = useRef(value)
  const [dir, setDir] = useState<FlashDir>(null)

  useEffect(() => {
    const previous = prev.current
    if (value === previous) return
    setDir(value > previous ? 'up' : 'down')
    prev.current = value
    const id = setTimeout(() => setDir(null), ms)
    return () => clearTimeout(id)
  }, [value, ms])

  return dir
}
