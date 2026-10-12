import { useSyncExternalStore } from 'react'

const KEY = 'overdrive:wishlist'
const listeners = new Set<() => void>()

const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

let snapshot = read()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const toggleWishlist = (id: string) => {
  snapshot = snapshot.includes(id) ? snapshot.filter((x) => x !== id) : [...snapshot, id]
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // modo privado: a lista vive só na sessão
  }
  listeners.forEach((l) => l())
}

export const useWishlist = () => useSyncExternalStore(subscribe, () => snapshot)
