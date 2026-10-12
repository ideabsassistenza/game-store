import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

// Build do PS5: aberto via file:// (onde o WebKit bloqueia <script type="module">) ou pelo /fs/ do websrv.
// Caminhos relativos e um único script clássico (IIFE) servem aos dois.
export default mergeConfig(
  base,
  defineConfig({
    mode: 'ps5',
    base: './',
    plugins: [
      {
        name: 'classic-script',
        transformIndexHtml: (html) => html.replace('<script type="module" crossorigin', '<script defer'),
      },
    ],
    build: {
      outDir: 'dist-ps5',
      modulePreload: false,
      rolldownOptions: {
        output: { format: 'iife', inlineDynamicImports: true },
      },
    },
  }),
)
