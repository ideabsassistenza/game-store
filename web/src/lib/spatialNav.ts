import { useEffect } from 'react'
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { heroCover, morphCover } from './coverMorph'
import { scrollToY, settledScrollY } from './scroller'
import { sound } from './sound'

type Dir = 'up' | 'down' | 'left' | 'right'

const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Último item focado e rolagem por tela, para o Voltar devolver o usuário exatamente de onde ele saiu
const remembered = new Map<string, string>()
const scrolls = new Map<string, number>()
const screenKey = () => window.location.pathname + window.location.search

// Com um menu aberto (data-nav-scope), a navegação fica presa às opções dele
const scope = () => document.querySelector('[data-nav-scope]') ?? document

const focusables = () =>
  [...scope().querySelectorAll<HTMLElement>('[data-nav]')].filter((el) => el.getClientRects().length > 0 && !el.hasAttribute('disabled') && !el.closest('[inert]'))

function distance(from: DOMRect, to: DOMRect, dir: Dir) {
  const fx = from.left + from.width / 2
  const fy = from.top + from.height / 2
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2

  const ahead = { right: tx > fx + 1, left: tx < fx - 1, down: ty > fy + 1, up: ty < fy - 1 }[dir]
  if (!ahead) return Infinity

  const horizontal = dir === 'left' || dir === 'right'
  const gap = Math.max(
    0,
    { right: to.left - from.right, left: from.left - to.right, down: to.top - from.bottom, up: from.top - to.bottom }[dir],
  )
  if (horizontal) {
    // Desalinhamento pesa mais que distância: andar para o lado fica na mesma linha
    return gap + Math.abs(ty - fy) * 2
  }
  // Na vertical conta a distância entre as bordas, não entre os centros: um botão curto à esquerda logo abaixo
  // (o "Show more") vence um card alinhado lá longe, e nenhuma linha da tela é pulada
  const edge = Math.max(0, to.left - from.right, from.left - to.right)
  return gap + edge * 0.5
}

export function focusElement(el: Element | null | undefined, smooth = true) {
  if (!(el instanceof HTMLElement)) return
  el.focus({ preventScroll: true })
  const animate = smooth && !reducedMotion()
  // Faixas horizontais (gêneros, miniaturas) e o painel de filtros rolam dentro de si até o item
  scrollContainersTo(el, animate ? 'smooth' : 'auto')
  // Cabeçalho e lateral são fixos na tela: a página não se mexe por eles
  if (el.closest('header, aside')) return

  // Itens que fazem parte de um bloco (a galeria) enquadram o bloco inteiro: a miniatura sozinha esconderia a imagem que ela mostra
  const frame = el.closest('[data-nav-frame]') ?? el
  const rect = frame.getBoundingClientRect()
  const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
  // Posição na tela depois que a rolagem em andamento assentar: com toques rápidos, decidir pelo meio do caminho dava trancos
  const top = rect.top + window.scrollY - settledScrollY()
  const visible = top >= headerBottom + 16 && top + rect.height <= window.innerHeight - 48
  if (visible) return
  const pageTop = rect.top + window.scrollY
  // O bloco encosta logo abaixo do cabeçalho; um item sozinho vai para perto do centro, como nas TVs
  const y = frame !== el ? pageTop - headerBottom - 24 : pageTop + rect.height / 2 - (window.innerHeight + headerBottom) / 2
  scrollToY(y, animate)
}

// Rola os contêineres com rolagem própria entre o item e a página (faixa de gêneros, miniaturas, painel de filtros)
function scrollContainersTo(el: HTMLElement, behavior: ScrollBehavior) {
  const r = el.getBoundingClientRect()
  const margin = parseFloat(getComputedStyle(el).scrollMarginLeft) || 0
  for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
    const style = getComputedStyle(box)
    const b = box.getBoundingClientRect()
    if (/auto|scroll/.test(style.overflowX) && box.scrollWidth > box.clientWidth) {
      const left = r.left - margin < b.left ? r.left - margin - b.left : r.right + margin > b.right ? r.right + margin - b.right : 0
      if (left) box.scrollBy({ left, behavior })
    }
    if (/auto|scroll/.test(style.overflowY) && box.scrollHeight > box.clientHeight) {
      const top = r.top < b.top ? r.top - b.top - 16 : r.bottom > b.bottom ? r.bottom - b.bottom + 16 : 0
      if (top) box.scrollBy({ top, behavior })
    }
  }
}

export const focusAutofocus = () => focusElement(document.querySelector('[data-autofocus]') ?? focusables()[0], false)

const rememberedElement = () => {
  const id = remembered.get(screenKey())
  return id ? document.querySelector(`[data-nav-id="${CSS.escape(id)}"]`) : null
}

export function restoreFocus() {
  const el = rememberedElement()
  if (!el) return false
  const y = scrolls.get(screenKey())
  if (y !== undefined) scrollToY(y, false)
  focusElement(el, false)
  return true
}

function move(dir: Dir, smooth: boolean) {
  const current = document.activeElement as HTMLElement | null
  if (!current?.matches('[data-nav]') || !scope().contains(current)) return focusAutofocus()

  const from = current.getBoundingClientRect()
  const horizontal = dir === 'left' || dir === 'right'
  // "Feixe": alvos alinhados com o item atual na direção do movimento, como nas interfaces de TV
  const inBeam = (r: DOMRect) => (horizontal ? r.top < from.bottom && from.top < r.bottom : r.left < from.right && from.left < r.right)
  const pick = (pool: HTMLElement[], beamOnly: boolean) => {
    let best: HTMLElement | undefined
    let bestScore = Infinity
    for (const el of pool) {
      const rect = el.getBoundingClientRect()
      if (beamOnly && !inBeam(rect)) continue
      const score = distance(from, rect, dir)
      if (score < bestScore) {
        bestScore = score
        best = el
      }
    }
    return best
  }

  // O painel lateral (filtros) é fixo e está sempre na tela: só se entra e sai dele pelas laterais,
  // senão ↑/↓ no fim da grade caíam nele e ficavam alternando entre os dois
  const inAside = !!current.closest('aside')
  const others = focusables().filter((el) => el !== current && (horizontal || !!el.closest('aside') === inAside))
  // O cabeçalho fixo está sempre na tela: com a página rolada, só entra nele quando o conteúdo acabou naquela direção.
  // No topo da página ele é de fato o que está acima, e disputa com o resto
  const pools =
    current.closest('header') || window.scrollY < 8
      ? [others]
      : [others.filter((el) => !el.closest('header')), others.filter((el) => el.closest('header'))]
  // ↑/↓ ficam dentro da região atual (a grade, o painel de filtros, a lista do destaque) enquanto houver para onde ir:
  // da 4ª coluna da grade, ↓ desce para a próxima linha e não escapa para os filtros ao lado
  const region = current.closest('[data-nav-region]')
  if (region && !horizontal) pools.unshift(others.filter((el) => region.contains(el)))
  // ←/→ só andam para o que está alinhado (não escorregam para outra linha da tela); ↑/↓ vão para o vizinho mais próximo
  const best = pools.map((pool) => pick(pool, horizontal)).find(Boolean)
  if (best) {
    sound.move()
    return focusElement(best, smooth)
  }
  // Sem alvo na direção (texto longo, rodapé): setas verticais rolam a página; dentro de um menu ou da busca, nada acontece
  if (scope() === document && (dir === 'up' || dir === 'down')) scrollToY(settledScrollY() + (dir === 'down' ? 1 : -1) * window.innerHeight * 0.4, smooth && !reducedMotion())
}

// Voltar de verdade no histórico (a tela anterior reaparece na mesma rolagem, com o foco no card de origem);
// sem histórico (link aberto direto), cai na home. A capa volta voando para o card de onde o usuário veio
export function goBack(navigate: NavigateFunction) {
  sound.back()
  const go = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))
  const from = heroCover()
  // Espera sumir a capa *deste* jogo: voltando de um jogo para outro, a tela anterior também tem capa no topo
  const slug = from?.getAttribute('data-hero-cover') ?? undefined
  morphCover(from, go, () => !heroCover(slug), () => rememberedElement()?.querySelector('[data-cover]'))
}

export function useSpatialNavigation() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    const onArrow = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (!dir || e.defaultPrevented) return
      const target = e.target
      // No campo de busca, ←/→ movem o cursor do texto; só saem do campo quando ele já está na ponta
      if (target instanceof HTMLInputElement && (dir === 'left' || dir === 'right')) {
        const atEdge = dir === 'left' ? target.selectionStart === 0 : target.selectionEnd === target.value.length
        if (!atEdge) return
      }
      e.preventDefault()
      // Seta segurada: rolagem instantânea, senão as animações suaves se acumulam e engasgam
      move(dir, !e.repeat)
    }

    // Com um menu aberto, Esc é dele (fecha o menu), não da navegação de volta
    const onBack = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches('input, textarea')
      const back = e.key === 'Escape' || (e.key === 'Backspace' && !typing)
      if (!back || document.querySelector('[data-nav-scope]') || pathname === '/') return
      e.preventDefault()
      goBack(navigate)
    }

    // Enter dá um "clique" físico: o item afunda e volta, com o som de confirmação
    const onPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== 'Enter' || e.repeat || !target.matches('[data-nav]') || target.matches('input')) return
      sound.select()
      if (!reducedMotion()) {
        target.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }], {
          duration: 240,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
    }

    // A rolagem é gravada no momento em que o usuário sai da tela (o clique/Enter que abre o jogo)
    const saveScroll = () => scrolls.set(screenKey(), window.scrollY)
    const onFocus = (e: FocusEvent) => {
      const id = (e.target as HTMLElement).dataset?.navId
      if (id) remembered.set(screenKey(), id)
    }
    // Safari não foca links clicados com o mouse: o clique também marca de onde o usuário saiu
    const onClick = (e: MouseEvent) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-id]')?.dataset.navId
      if (id) remembered.set(screenKey(), id)
      saveScroll()
    }

    window.addEventListener('keydown', onArrow)
    window.addEventListener('keydown', onPress)
    window.addEventListener('keydown', onBack, true)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onArrow)
      window.removeEventListener('keydown', onPress)
      window.removeEventListener('keydown', onBack, true)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('click', onClick, true)
    }
  }, [navigate, pathname])
}
