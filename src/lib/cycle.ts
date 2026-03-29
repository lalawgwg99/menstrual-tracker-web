import type { PeriodEntry } from './types.js'

export function getDaysBetween(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00')
  const dateB = new Date(b + 'T00:00:00')
  return Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24))
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

interface Defaults {
  cycleLength: number
  periodLength: number
}

export function getPredictions(
  entries: PeriodEntry[],
  defaults: Defaults
): { nextPeriod: string; ovulation: string; fertileStart: string; fertileEnd: string } | null {
  if (entries.length === 0) return null

  const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const lastEntry = sorted[0]

  let avgCycle = defaults.cycleLength
  if (entries.length >= 2) {
    const cycleLengths: number[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = getDaysBetween(sorted[i + 1].startDate, sorted[i].startDate)
      if (diff > 0 && diff < 100) cycleLengths.push(diff)
    }
    if (cycleLengths.length > 0) {
      avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    }
  }

  const nextPeriod = addDays(lastEntry.startDate, avgCycle)
  const ovulation = addDays(nextPeriod, -14)
  const fertileStart = addDays(ovulation, -5)
  const fertileEnd = addDays(ovulation, 1)

  return { nextPeriod, ovulation, fertileStart, fertileEnd }
}

export type DayStatus = 'period' | 'ovulation' | 'fertile' | 'predicted-period' | 'predicted-fertile' | 'predicted-ovulation' | 'today' | null

export function getDayStatus(
  date: string,
  entries: PeriodEntry[],
  defaults: Defaults
): DayStatus {
  const todayStr = today()

  // Check if it's an actual period day
  for (const entry of entries) {
    if (date >= entry.startDate && date <= entry.endDate) {
      return 'period'
    }
  }

  // Get predictions
  const predictions = getPredictions(entries, defaults)
  if (predictions) {
    const { nextPeriod, ovulation, fertileStart, fertileEnd } = predictions

    // Predicted period (5 days from nextPeriod)
    const predictedPeriodEnd = addDays(nextPeriod, defaults.periodLength - 1)
    if (date >= nextPeriod && date <= predictedPeriodEnd) {
      return 'predicted-period'
    }

    // Predicted ovulation
    if (date === ovulation) {
      return 'predicted-ovulation'
    }

    // Predicted fertile window (excluding ovulation day which is already handled)
    if (date >= fertileStart && date <= fertileEnd) {
      return 'predicted-fertile'
    }
  }

  // Today
  if (date === todayStr) {
    return 'today'
  }

  return null
}

export function getCycleStats(entries: PeriodEntry[]): { avgCycle: number; avgPeriod: number; count: number } {
  const count = entries.length
  if (count === 0) return { avgCycle: 0, avgPeriod: 0, count: 0 }

  // Average period length
  const periodLengths = entries.map(e => getDaysBetween(e.startDate, e.endDate) + 1)
  const avgPeriod = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)

  // Average cycle length
  if (count < 2) return { avgCycle: 0, avgPeriod, count }

  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const cycleLengths: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = getDaysBetween(sorted[i - 1].startDate, sorted[i].startDate)
    if (diff > 0 && diff < 100) cycleLengths.push(diff)
  }

  const avgCycle = cycleLengths.length > 0
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : 0

  return { avgCycle, avgPeriod, count }
}

export function getRecentCycleLengths(entries: PeriodEntry[], n: number = 6): number[] {
  if (entries.length < 2) return []
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const lengths: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff = getDaysBetween(sorted[i - 1].startDate, sorted[i].startDate)
    if (diff > 0 && diff < 100) lengths.push(diff)
  }
  return lengths.slice(-n)
}

export function getCurrentCycleDay(entries: PeriodEntry[]): number | null {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const lastStart = sorted[0].startDate
  const todayStr = today()
  if (todayStr < lastStart) return null
  return getDaysBetween(lastStart, todayStr) + 1
}