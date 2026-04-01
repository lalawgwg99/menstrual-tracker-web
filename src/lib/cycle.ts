import type { PeriodEntry } from './types.js'

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDaysBetween(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00')
  const dateB = new Date(b + 'T00:00:00')
  return Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24))
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return formatLocalDate(d)
}

export function today(): string {
  return formatLocalDate(new Date())
}

interface Defaults {
  cycleLength: number
  periodLength: number
}

function getCycleLengths(entries: PeriodEntry[]): number[] {
  const sortedAsc = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const lengths: number[] = []
  for (let i = 1; i < sortedAsc.length; i++) {
    const diff = getDaysBetween(sortedAsc[i - 1].startDate, sortedAsc[i].startDate)
    if (diff > 0 && diff < 100) lengths.push(diff)
  }
  return lengths
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function filterOutliers(lengths: number[]): number[] {
  if (lengths.length < 6) return lengths
  const med = median(lengths)
  const deviations = lengths.map(l => Math.abs(l - med))
  const mad = median(deviations)
  if (mad === 0) return lengths
  const threshold = mad * 2.5
  return lengths.filter(l => Math.abs(l - med) <= threshold)
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
    const cycleLengths = filterOutliers(getCycleLengths(entries))
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

export interface CycleConfidence {
  score: number
  avg: number
  sd: number
  range: { min: number; max: number }
  count: number
}

export function getCycleConfidence(
  entries: PeriodEntry[],
  defaults: Defaults
): CycleConfidence | null {
  if (entries.length === 0) return null
  const cycleLengths = filterOutliers(getCycleLengths(entries))

  const count = cycleLengths.length
  if (count === 0) {
    const base = defaults.cycleLength
    return { score: 30, avg: base, sd: 0, range: { min: base - 2, max: base + 2 }, count }
  }

  const avg = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / count)
  const variance = cycleLengths.reduce((a, b) => a + (b - avg) ** 2, 0) / count
  const sd = Math.sqrt(variance)

  let score = Math.round(100 - sd * 14)
  if (count < 3) score = Math.min(score, 45)
  if (count >= 3 && count < 6) score = Math.min(score, 70)
  score = Math.max(25, Math.min(95, score))

  const rangePad = Math.max(1, Math.round(sd))
  return {
    score,
    avg,
    sd,
    range: { min: avg - rangePad, max: avg + rangePad },
    count
  }
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

export interface CyclePhase {
  name: string
  insight: string
  colorVar: string // e.g. '--period'
  progress: number // 0 to 1
}

export function getDetailedPhase(
  entries: PeriodEntry[],
  defaults: Defaults
): CyclePhase | null {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const lastEntry = sorted[0]
  const todayStr = today()

  const stats = getCycleStats(entries)
  const cycleLen = stats.avgCycle > 0 ? stats.avgCycle : defaults.cycleLength
  const periodLen = defaults.periodLength

  const cycleDay = getCurrentCycleDay(entries)
  if (cycleDay === null) return null

  const predictions = getPredictions(entries, defaults)
  if (!predictions) return null

  const isActuallyLoggedPeriod = todayStr >= lastEntry.startDate && todayStr <= lastEntry.endDate;

  // 1. Menstruation
  if (isActuallyLoggedPeriod || (todayStr >= lastEntry.startDate && cycleDay <= periodLen)) {
    return {
      name: '經期 (月經)',
      insight: '多喝溫水，注意腹部保暖。給自己多一點休息的時間吧！',
      colorVar: 'var(--period)',
      progress: Math.min(cycleDay / periodLen, 1) * 0.25
    }
  }

  // 2. Fertile & Ovulation
  if (todayStr >= predictions.fertileStart && todayStr <= predictions.fertileEnd) {
    const totalFertile = getDaysBetween(predictions.fertileStart, predictions.fertileEnd) + 1
    const currentFertile = getDaysBetween(predictions.fertileStart, todayStr) + 1
    return {
      name: todayStr === predictions.ovulation ? '排卵日' : '易孕期',
      insight: '這是身體活力最旺盛的時期喔！但也別忘了適度放鬆與保養身體。',
      colorVar: 'var(--fertile)',
      progress: 0.5 + Math.min(currentFertile / totalFertile, 1) * 0.25
    }
  }

  // 3. Follicular
  if (todayStr < predictions.fertileStart) {
    const startF = addDays(lastEntry.startDate, periodLen)
    const totalF = Math.max(1, getDaysBetween(startF, predictions.fertileStart))
    const currF = Math.max(0, getDaysBetween(startF, todayStr))
    return {
      name: '濾泡期',
      insight: '雌激素逐漸穩定，這幾天通常心情與體力都會比較好喔！可以安排些想做的事。',
      colorVar: 'var(--ovulation)',
      progress: 0.25 + Math.min(currF / totalF, 1) * 0.25
    }
  }

  // 4. Luteal (PMS zone)
  const startL = addDays(predictions.fertileEnd, 1)
  const totalL = Math.max(1, getDaysBetween(startL, predictions.nextPeriod))
  const currL = Math.max(0, getDaysBetween(startL, todayStr))
  const daysUntil = getDaysBetween(todayStr, predictions.nextPeriod)

  let insightText = '黃體期容易有經前症候群 (PMS)，若感到胸部微脹或情緒小起伏都是正常的喔☕️。'
  if (daysUntil <= 3 && daysUntil > 0) {
    insightText = `距離預測經期約剩 ${daysUntil} 天，可以開始準備生理用品囉。放寬心準備迎接週期。`
  } else if (daysUntil <= 0) {
    insightText = '經期隨時可能報到，請備妥用品。如果遲來幾天也別太焦慮喔！'
  }

  return {
    name: '黃體期',
    insight: insightText,
    colorVar: 'var(--text-muted)',
    progress: Math.min(0.75 + Math.min(currL / totalL, 1) * 0.25, 0.99)
  }
}
