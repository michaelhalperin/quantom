import { useEffect, useRef, useState } from 'react'

/** Smoothly animates a number toward `value` using an ease-out cubic. */
export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    const from = displayRef.current
    const to = value
    if (Math.abs(to - from) < 1e-9) {
      setDisplay(to)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return display
}
