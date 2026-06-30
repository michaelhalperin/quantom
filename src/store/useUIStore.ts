import { create } from 'zustand'
import { randomId } from '@/lib/utils'

type Theme = 'dark' | 'light'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: 'default' | 'success' | 'error' | 'warning'
}

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  commandOpen: boolean
  toasts: Toast[]
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setCommandOpen: (v: boolean) => void
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('qd-theme')
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', t === 'dark')
  try {
    localStorage.setItem('qd-theme', t)
  } catch {
    /* ignore */
  }
}

const initialTheme = readTheme()
applyTheme(initialTheme)

export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  sidebarCollapsed: false,
  commandOpen: false,
  toasts: [],

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  addToast: (t) => {
    const id = randomId('toast')
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 4200)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))
