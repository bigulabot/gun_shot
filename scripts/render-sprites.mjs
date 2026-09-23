// Renders Finlay's sprites from sprites.js as PNG previews: each one big on
// its own, plus a line-up next to Ozo at the size they'd be in the game.
//   art/finlay-enemies/  mushy, spike and rolling spike-ball (with the Snapper and Spitter)
//   art/finlay-bosses/   prince-nova, ring-star, rap-bandit
// Run with: node scripts/render-sprites.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { SPRITES, PX } from '../src/game/sprites.js'
import { canvas, fillRect, bounds, drawRows, encodePNG } from './pixel-png.mjs'

const SKY = '#9ad8f0', GRASS = '#78d04e', DIRT = '#c27a4a'
const sets = [
  { dir: 'art/finlay-enemies', sprites: ['mushy', 'spike', 'spike-ball'], lineup: ['ozo-idle', 'snapper', 'spitter', 'mushy', 'spike', 'spike-ball'] },
  { dir: 'art/finlay-bosses', sprites: ['prince-nova', 'ring-star', 'rap-bandit'], lineup: ['ozo-idle', 'prince-nova', 'ring-star', 'rap-bandit'] },
]

for (const { dir, sprites, lineup } of sets) {
  mkdirSync(dir, { recursive: true })

  // Each sprite on its own, big, with a see-through background.
  const BIG = 16
  for (const key of sprites) {
    const rows = SPRITES[key], box = bounds(rows), pad = 2
    const image = canvas((box.width + pad * 2) * BIG, (box.height + pad * 2) * BIG)
    drawRows(image, rows, (pad - box.minX) * BIG, (pad - box.minY) * BIG, BIG)
    writeFileSync(`${dir}/${key}.png`, encodePNG(image))
    console.log(`wrote ${dir}/${key}.png`)
  }

  // Line-up on a strip of level: everyone standing on the same ground, at
  // twice their in-game size (game art pixels are PX = 4 screen pixels).
  const scale = PX * 2, gap = 6 * scale, boxes = lineup.map(key => bounds(SPRITES[key]))
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
  writeFileSync(`${dir}/lineup.png`, encodePNG(sheet))
  console.log(`wrote ${dir}/lineup.png (${lineup.join(', ')})`)
}
