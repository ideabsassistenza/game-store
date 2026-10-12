# Overdrive — loja de jogos

React 19 + Vite + Tailwind v4 + React Router. Motion nas animações.

```bash
npm install
npm run dev
```

App de loja para TV, navegável só com setas, Enter e Esc (ou Backspace); mouse também funciona. A escala segue a altura da tela (1rem = 24px em 1080p, igual em qualquer TV 16:9); telas proporcionalmente mais largas mostram mais itens (colunas, rankings, relacionados).

- `/` — destaque, rankings, gêneros, capas, filtros e busca.
- `/game/:slug` — artes, galeria, descrição, detalhes e relacionados, sem download.

Catálogo Spectrum enriquecido pela API pública da loja Steam, preservando a interface. Jogos sem correspondência usam as capas do catálogo. DLCs são excluídos e jogos repetidos são agrupados pelo identificador e pelo nome, incluindo variantes regionais. Para atualizar: `node scripts/fetch-catalog.mjs /caminho/catalogo.json`. Os dados ficam no repositório privado do catálogo, em `store/` (`OVERDRIVE_CATALOG_DIR`, por padrão `../overdrive-catalog` ao lado deste repositório; veja `native/scripts/catalog-dir.mjs`). Sem argumento, usa `store/spectrum.json`. As correspondências são armazenadas em `store/steam-cache.json`, com nomes alternativos em `store/steam-aliases.json`; `store/steam-matches.json` registra os jogos encontrados e as consultas pendentes. O importador também valida o conteúdo de capas e artes de fundo, rejeitando o placeholder cinza da Steam.

```
src/
  components/   layout (Header, Footer, Logo, ScrollToTop), ui (Button, WishHeart, Menu), GameCard, GameLogo, FadeImage, SectionHeader
  features/
    browse/     BrowsePage + Spotlight, TopCharts, GenreRail, FilterPanel, SortSelect, ActiveFilters, useGameFilters
    game/       GamePage + GameHero, MediaGallery, GameFacts, DownloadButton, About, Requirements
  lib/          catalog (tipos, filtros, formatação), spatialNav (setas/voltar), sound (sons da interface), wishlist
```
