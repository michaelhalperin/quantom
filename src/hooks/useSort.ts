import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSort<T>(data: T[], initialKey: keyof T, initialDir: SortDir = 'desc') {
  const [key, setKey] = useState<keyof T>(initialKey)
  const [dir, setDir] = useState<SortDir>(initialDir)

  const sorted = useMemo(() => {
    const arr = [...data]
    arr.sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av
      }
      return dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return arr
  }, [data, key, dir])

  const toggle = (k: keyof T) => {
    if (k === key) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setKey(k)
      setDir('desc')
    }
  }

  return { sorted, sortKey: key, dir, toggle }
}
