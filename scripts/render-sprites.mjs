// Renders Finlay's enemy sprites from sprites.js as PNG previews in
// art/finlay-enemies/, plus a line-up next to Ozo and the current enemies at
// the size they'd be in the game. Run with: node scripts/render-sprites.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { SPRITES, PX } from '../src/game/sprites.js'
import { canvas, fillRect, bounds, drawRows, encodePNG } from './pixel-png.mjs'

const OUT = 'art/finlay-enemies'
const SKY = '#9ad8f0', GRASS = '#78d04e', DIRT = '#c27a4a'
mkdirSync(OUT, { recursive: true })

// Each sprite on its own, big, with a see-through background.
const BIG = 16
for (const key of ['hatter', 'spiky']) {
  const rows = SPRITES[key], box = bounds(rows), pad = 2
  const image = canvas((box.width + pad * 2) * BIG, (box.height + pad * 2) * BIG)
  drawRows(image, rows, (pad - box.minX) * BIG, (pad - box.minY) * BIG, BIG)
  writeFileSync(`${OUT}/${key}.png`, encodePNG(image))
  console.log(`wrote ${OUT}/${key}.png`)
}

// Line-up on a strip of level: everyone standing on the same ground, at
// twice their in-game size (game art pixels are PX = 4 screen pixels).
const scale = PX * 2, gap = 6 * scale, lineup = ['ozo-idle', 'snapper', 'spitter', 'hatter', 'spiky']
const boxes = lineup.map(key => bounds(SPRITES[key]))
const width = boxes.reduce((sum, box) => sum + box.width * scale + gap, gap)
const tallest = Math.max(...boxes.map(box => box.height)) * scale
const floor = tallest + 4 * scale, height = floor + 10 * scale
const sheet = canvas(width, height, SKY)
fillRect(sheet, 0, floor, width, floor + 3 * scale, GRASS)
fillRect(sheet, 0, floor + 3 * scale, width, height, DIRT)
let x = gap
lineup.forEach((key, i) => {
  const box = boxes[i]
  drawRows(sheet, SPRITES[key], x - box.minX * scale, floor - (box.maxY + 1) * scale, scale)
  x += box.width * scale + gap
})
writeFileSync(`${OUT}/lineup.png`, encodePNG(sheet))
console.log(`wrote ${OUT}/lineup.png (${lineup.join(', ')})`)
