const NAME = 'game-cover'

// Durante a troca com capa voando a própria View Transition faz o fade: a página não soma um fade dela por cima
let morphing = false
export const isMorphing = () => morphing

const inView = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
}

async function until(done: () => boolean, timeout = 800) {
  const start = performance.now()
  while (!done() && performance.now() - start < timeout) await new Promise((r) => setTimeout(r, 16))
}

// A capa de origem e a de destino recebem o mesmo nome só durante a troca de tela:
// o navegador fotografa as duas e interpola posição e tamanho, como a capa "voando" no console.
// O router aplica a navegação numa transition do React, por isso esperamos a tela nova existir antes de liberar a captura.
export function morphCover(from: Element | null | undefined, navigate: () => void, arrived: () => boolean, target: () => Element | null | undefined) {
  if (!document.startViewTransition || !(from instanceof HTMLElement) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return navigate()
  }

  from.style.viewTransitionName = NAME
  morphing = true
  let to: HTMLElement | null = null
  const transition = document.startViewTransition(async () => {
    from.style.viewTransitionName = ''
    navigate()
    await until(arrived)
    const el = target()
    if (el instanceof HTMLElement && inView(el)) {
      to = el
      to.style.viewTransitionName = NAME
    }
  })
  transition.updateCallbackDone.finally(() => (morphing = false))
  transition.finished.finally(() => to?.style.removeProperty('view-transition-name'))
}

export const heroCover = (slug?: string) => document.querySelector(slug ? `[data-hero-cover="${slug}"]` : '[data-hero-cover]')
