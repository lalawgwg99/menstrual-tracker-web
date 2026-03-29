import type { PeriodEntry } from './types.js'

const ENTRIES_KEY = 'cycle-entries'
const CYCLE_LENGTH_KEY = 'cycle-default-length'
const PERIOD_LENGTH_KEY = 'period-default-length'

function createStore() {
  let entries = $state<PeriodEntry[]>([])
  let cycleLength = $state(28)
  let periodLength = $state(5)
  let initialized = $state(false)

  function init() {
    if (initialized) return
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
    initialized = true
  }

  function saveEntries() {
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
    } catch (e) {
      console.error('Failed to save entries', e)
    }
  }

  function addEntry(entry: Omit<PeriodEntry, 'id'>) {
    init()
    const newEntry: PeriodEntry = {
      ...entry,
      id: crypto.randomUUID()
    }
    entries = [...entries, newEntry].sort((a, b) => a.startDate.localeCompare(b.startDate))
    saveEntries()
  }

  function updateEntry(id: string, updates: Partial<Omit<PeriodEntry, 'id'>>) {
    init()
    entries = entries.map(e => e.id === id ? { ...e, ...updates } : e)
    saveEntries()
  }

  function deleteEntry(id: string) {
    init()
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

  return {
    get entries() { init(); return entries },
    get cycleLength() { return cycleLength },
    get periodLength() { return periodLength },
    get initialized() { return initialized },
    init,
    addEntry,
    updateEntry,
    deleteEntry,
    setDefaultCycleLength,
    setDefaultPeriodLength
  }
}

export const store = createStore()