import type { PeriodEntry } from './types.js'
import { getPredictions } from './cycle.js'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function scheduleReminders(
  entries: PeriodEntry[],
  defaults: { cycleLength: number; periodLength: number },
  periodReminder: boolean,
  tempReminder: boolean,
  tempReminderTime: string
) {
  const existingId = Number(localStorage.getItem('reminder-interval-id') ?? '0')
  if (existingId) clearInterval(existingId)

  if (Notification.permission !== 'granted') return
  if (!periodReminder && !tempReminder) return

  function check() {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${hh}:${mm}`

    if (tempReminder && currentTime === tempReminderTime) {
      const lastTempNotif = localStorage.getItem('last-temp-notif')
      if (lastTempNotif !== todayStr) {
        new Notification('🌡️ 量體溫提醒', {
          body: '記得在起床前量基礎體溫！',
          icon: '/vite.svg'
        })
        localStorage.setItem('last-temp-notif', todayStr)
      }
    }

    if (periodReminder) {
      const predictions = getPredictions(entries, defaults)
      if (predictions) {
        const nextDate = new Date(predictions.nextPeriod + 'T00:00:00')
        const todayDate = new Date(todayStr + 'T00:00:00')
        const daysUntil = Math.round((nextDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntil === 3 || daysUntil === 1) {
          const notifKey = `${predictions.nextPeriod}-${daysUntil}`
          const lastKey = localStorage.getItem('last-period-notif')
          if (lastKey !== notifKey) {
            new Notification('🌸 經期快到了', {
              body: daysUntil === 3 ? '預計 3 天後來經期，記得備好衛生用品！' : '明天預計來經期，注意保暖～',
              icon: '/vite.svg'
            })
            localStorage.setItem('last-period-notif', notifKey)
          }
        }
      }
    }
  }

  check()
  const intervalId = setInterval(check, 60 * 1000)
  localStorage.setItem('reminder-interval-id', String(intervalId))
}
