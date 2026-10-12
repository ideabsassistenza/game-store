import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollToY } from '../../lib/scroller'
import { focusAutofocus, focusElement, restoreFocus } from '../../lib/spatialNav'

// A cada tela nova: volta ao topo e foca o elemento inicial; no Voltar, devolve o foco ao item de onde o usuário saiu
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()
  const navigationType = useNavigationType()

  // Síncrono no commit: a transição de capa fotografa a tela nova já rolada e com o foco no lugar
  useLayoutEffect(() => {
    // Filtros e ordenação substituem a URL (e derrubam o #catalog): é a mesma tela, nada de topo nem foco novo
    if (navigationType === 'REPLACE') return
    // No Voltar o navegador já devolve a rolagem: só o foco volta para o item de onde o usuário saiu.
    // Vem antes da âncora: voltar para /#catalog não é entrar de novo no catálogo
    if (navigationType === 'POP' && restoreFocus()) {
      // Voltando para /#catalog o navegador ainda pula até a âncora depois disso e tira o foco: reaplica na sequência
      if (hash) requestAnimationFrame(() => restoreFocus())
      return
    }
    if (hash) {
      const section = document.getElementById(hash.slice(1))
      return focusElement(
        section?.querySelector('[data-slug]:not([inert] *)') ?? section?.querySelector('[data-autofocus]') ?? section?.querySelector('[data-nav]'),
      )
    }
    // Tela nova, primeiro carregamento ou Voltar sem posição guardada: topo e foco inicial
    scrollToY(0, false)
    focusAutofocus()
    // A query entra porque os atalhos do cabeçalho (Top rated → New releases) só trocam ela; filtros também trocam,
    // mas chegam como REPLACE e saem logo no começo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, hash])

  return null
}
