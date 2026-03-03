import { create } from 'zustand'

export type LogCategory = 'CANVAS' | 'CONNECTION' | 'STORE' | 'SCRAPE' | 'LLM' | 'PROJECT' | 'VIEW' | 'SYSTEM'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: number
  timestamp: number
  category: LogCategory
  level: LogLevel
  message: string
  detail?: string
}

interface LogState {
  entries: LogEntry[]
  isOpen: boolean
  filter: LogCategory | null
  log: (category: LogCategory, message: string, detail?: string, level?: LogLevel) => void
  clear: () => void
  toggleOpen: () => void
  setFilter: (filter: LogCategory | null) => void
}

const MAX_ENTRIES = 500
let nextId = 1

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  isOpen: false,
  filter: null,

  log: (category, message, detail, level = 'info') => {
    const entry: LogEntry = {
      id: nextId++,
      timestamp: Date.now(),
      category,
      level,
      message,
      detail,
    }
    set((state) => ({
      entries: [...state.entries, entry].slice(-MAX_ENTRIES),
    }))
  },

  clear: () => set({ entries: [] }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setFilter: (filter) => set({ filter }),
}))
