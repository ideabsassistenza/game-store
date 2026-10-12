// Rolagem da página para a navegação por controle: um alvo só, perseguido quadro a quadro.
// O scrollIntoView suave do navegador recomeça do zero a cada toque; com toques rápidos a página nunca alcançava
// o foco e andava aos trancos, como se fosse puxada. Aqui cada toque só move o alvo e a rolagem segue contínua.

let target: number | null = null
let frame = 0
let lastTime = 0

// Constante de tempo da aproximação exponencial: ~95% do caminho em 3τ
const TAU = 70

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
const clamp = (y: number) => Math.max(0, Math.min(maxScroll(), y))

function step(now: number) {
  if (target === null) return
  const dt = Math.min(64, now - lastTime)
  lastTime = now
  const current = window.scrollY
  const distance = target - current
  if (Math.abs(distance) < 0.5) {
    window.scrollTo(0, target)
    target = null
    frame = 0
    return
  }
  window.scrollTo(0, current + distance * (1 - Math.exp(-dt / TAU)))
  frame = requestAnimationFrame(step)
}

export function stopScroll() {
  cancelAnimationFrame(frame)
  frame = 0
  target = null
}

// Onde a página vai parar: as decisões de rolagem olham para o destino, não para o meio do caminho
export const settledScrollY = () => target ?? window.scrollY

export function scrollToY(y: number, smooth: boolean) {
  if (!smooth) {
    stopScroll()
    return window.scrollTo(0, clamp(y))
  }
  target = clamp(y)
  if (!frame) {
    lastTime = performance.now()
    frame = requestAnimationFrame(step)
  }
}

// Roda do mouse ou toque no trackpad assumem o controle: a animação não briga com a mão do usuário
for (const event of ['wheel', 'touchstart'] as const) window.addEventListener(event, stopScroll, { passive: true })
