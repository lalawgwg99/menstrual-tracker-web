import type { PeriodEntry, DailyLog } from './types.js'

const ENTRIES_KEY = 'cycle-entries'
const CYCLE_LENGTH_KEY = 'cycle-default-length'
const PERIOD_LENGTH_KEY = 'period-default-length'

function createStore() {
  let entries = $state<PeriodEntry[]>([])
  let cycleLength = $state(28)
  let periodLength = $state(5)
  // plain boolean — NOT $state, so mutations inside init() don't
  // accidentally fire inside $derived computations
  let initialized = false

  function init() {
    if (initialized) return
    initialized = true
    try {
      const saved = localStorage.getItem(ENTRIES_KEY)
      if (saved) entries = JSON.parse(saved)
      const cl = localStorage.getItem(CYCLE_LENGTH_KEY)
      if (cl) cycleLength = parseInt(cl)
      const pl = localStorage.getItem(PERIOD_LENGTH_KEY)
      if (pl) periodLength = parseInt(pl)
    } catch (e) {
      console.error('Failed to load from localStorage', e)
    }
  }

  function saveEntries() {
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
    } catch (e) {
      console.error('Failed to save entries', e)
    }
  }

  function addEntry(entry: Omit<PeriodEntry, 'id'>) {
    const newEntry: PeriodEntry = {
      ...entry,
      id: crypto.randomUUID()
    }
    entries = [...entries, newEntry].sort((a, b) => a.startDate.localeCompare(b.startDate))
    saveEntries()
  }

  function updateEntry(id: string, updates: Partial<Omit<PeriodEntry, 'id'>>) {
    entries = entries.map(e => e.id === id ? { ...e, ...updates } : e)
    saveEntries()
  }

  function deleteEntry(id: string) {
    entries = entries.filter(e => e.id !== id)
    saveEntries()
  }

  function setDefaultCycleLength(len: number) {
    cycleLength = len
    try {
      localStorage.setItem(CYCLE_LENGTH_KEY, String(len))
    } catch (e) {}
  }

  function setDefaultPeriodLength(len: number) {
    periodLength = len
    try {
      localStorage.setItem(PERIOD_LENGTH_KEY, String(len))
    } catch (e) {}
  }

  function upsertDailyLog(entryId: string, log: DailyLog) {
    entries = entries.map(e => {
      if (e.id !== entryId) return e
      const existingLogs = e.logs ?? []
      const idx = existingLogs.findIndex(l => l.date === log.date)
      const newLogs = idx >= 0
        ? existingLogs.map((l, i) => i === idx ? { ...l, ...log } : l)
        : [...existingLogs, log]
      return { ...e, logs: newLogs }
    })
    saveEntries()
  }

  function getDailyLog(entryId: string, date: string): DailyLog | undefined {
    const entry = entries.find(e => e.id === entryId)
    return entry?.logs?.find(l => l.date === date)
  }

  return {
    // Simple getters — no side effects, safe to call from $derived
    get entries() { return entries },
    get cycleLength() { return cycleLength },
    get periodLength() { return periodLength },
    init,
    addEntry,
    updateEntry,
    deleteEntry,
    setDefaultCycleLength,
    setDefaultPeriodLength,
    upsertDailyLog,
    getDailyLog
  }
}

export const store = createStore()
