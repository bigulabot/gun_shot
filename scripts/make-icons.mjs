// Makes the home-screen / PWA icons from Ozo's own placeholder pixel art, so
// the icon always matches the game. Run with: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { SPRITES } from '../src/game/sprites.js'
import { canvas, bounds, drawRows, encodePNG } from './pixel-png.mjs'

const INK = '#10202c' // --ink, the game's background colour

// Ozo centred on a square of ink, each art pixel `scale` px across. Centred on
// the drawn pixels, not the padded grid, so he isn't shoved to one side.
function makeIcon(size, scale) {
  const rows = SPRITES['ozo-idle'], box = bounds(rows), image = canvas(size, size, INK)
  const x = Math.round((size - box.width * scale) / 2) - box.minX * scale
  const y = Math.round((size - box.height * scale) / 2) - box.minY * scale + Math.round(size * 0.03)
  drawRows(image, rows, x, y, scale)
  return encodePNG(image)
}

mkdirSync('public/icons', { recursive: true })
for (const [size, scale] of [[512, 16], [192, 6], [180, 5.6], [32, 1]]) {
  const png = makeIcon(size, scale)
  writeFileSync(`public/icons/icon-${size}.png`, png)
  console.log(`wrote public/icons/icon-${size}.png (${png.length} bytes)`)
}
