import { useEffect, useState } from 'react'

// Recorte real do logo dentro do PNG (frações da imagem) e se a arte é escura demais para fundo escuro.
// O limite de 68% de pixels escuros pega o CS2 (72%) e deixa de fora logos dourados ou com contorno preto (Elden Ring 62%, RDR2 54%)
export type LogoBox = { x: number; y: number; w: number; h: number; aspect: number; dark: boolean }

const cache = new Map<string, Promise<LogoBox | null>>()

// Os logo.png da Steam vêm com margens transparentes diferentes: sem medir, um logo fica gigante e outro minúsculo
function measure(src: string) {
  if (!src) return Promise.resolve(null)
  return new Promise<LogoBox | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      const { naturalWidth: W, naturalHeight: H } = img
      const ctx = Object.assign(document.createElement('canvas'), { width: W, height: H }).getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, W, H).data
      let minX = W, minY = H, maxX = -1, maxY = -1, opaque = 0, darkPixels = 0
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const a = data[i + 3]
          if (a < 24) continue
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          opaque++
          if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < 64) darkPixels++
        }
      }
      if (maxX < 0) return resolve(null)
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      resolve({ x: minX / W, y: minY / H, w: w / W, h: h / H, aspect: w / h, dark: darkPixels / opaque > 0.68 })
    }
    img.src = src
  })
}

export function useLogoBox(src: string) {
  const [box, setBox] = useState<{ src: string; value: LogoBox | null }>()

  useEffect(() => {
    let alive = true
    if (!cache.has(src)) cache.set(src, measure(src))
    cache.get(src)!.then((value) => alive && setBox({ src, value }))
    return () => {
      alive = false
    }
  }, [src])

  // undefined enquanto mede; null quando não há logo utilizável
  return box?.src === src ? box.value : undefined
}
