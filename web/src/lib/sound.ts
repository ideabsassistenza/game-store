import { useSyncExternalStore } from 'react'

// Sons da interface gerados na hora (sem arquivos): cliques curtos e baixos, como nos menus de console.
// Desligados por padrão; só tocam depois que a pessoa liga no cabeçalho.
const KEY = 'overdrive:sound'
const listeners = new Set<() => void>()
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
})()
let ctx: AudioContext | undefined

function tone(freq: number, duration: number, volume: number, delay = 0) {
  if (!enabled) return
  ctx ??= new AudioContext()
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export const sound = {
  move: () => tone(1480, 0.04, 0.02),
  select: () => {
    tone(880, 0.07, 0.035)
    tone(1320, 0.09, 0.025, 0.045)
  },
  back: () => tone(620, 0.08, 0.03),
  success: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.22, 0.03, i * 0.09)),
}

export const toggleSound = () => {
  enabled = !enabled
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off')
  } catch {
    // modo privado: a preferência vale só para a sessão
  }
  if (enabled) sound.select()
  listeners.forEach((l) => l())
}

export const useSoundEnabled = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => enabled,
  )
