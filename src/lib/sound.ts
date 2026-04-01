const SOUND_ENABLED_KEY = 'ui-sound-enabled'

let audioCtx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!('AudioContext' in window || 'webkitAudioContext' in window)) return null
  if (!audioCtx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    audioCtx = new Ctor()
  }
  return audioCtx
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const value = localStorage.getItem(SOUND_ENABLED_KEY)
  return value === null ? true : value === 'true'
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled))
}

function playTone(freq: number, durationMs: number, gainValue: number, type: OscillatorType = 'sine') {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(gainValue, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + 0.01)
}

export function playTap() {
  playTone(620, 38, 0.025, 'triangle')
}

export function playSuccess() {
  playTone(620, 50, 0.03, 'sine')
  setTimeout(() => playTone(820, 70, 0.03, 'sine'), 45)
}

export function playDelete() {
  playTone(280, 60, 0.03, 'sawtooth')
}
