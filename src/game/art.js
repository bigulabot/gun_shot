// Turns the letter grids in sprites.js into Phaser textures (one per sprite,
// named after its key). The painted artwork from before is in archive/painted-v1.
import { SPRITES, PALETTE } from './sprites.js'

function drawSprite(rows, scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(...rows.map(row => row.length)) * scale
  canvas.height = rows.length * scale
  const c = canvas.getContext('2d')
  rows.forEach((row, y) => [...row].forEach((letter, x) => {
    if (letter === '.' || !PALETTE[letter]) return
    c.fillStyle = PALETTE[letter]
    c.fillRect(x * scale, y * scale, scale, scale)
  }))
  return canvas
}

export function createArt(scene) {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawSprite(rows))
  }
  // The broken-heart halves for the death animation.
  for (const [key, keep] of [['heart-0', col => col < 4], ['heart-1', col => col >= 4]]) {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawSprite(SPRITES.heart.map(row => [...row].map((l, i) => keep(i) ? l : '.').join(''))))
  }
}

// Any sprite as an image for the page (menus, HUD), scaled up crisply by CSS.
const images = new Map()
export function spriteURL(name, scale = 8) {
  const id = `${name}@${scale}`
  if (!images.has(id)) images.set(id, drawSprite(SPRITES[name], scale).toDataURL())
  return images.get(id)
}
// A small image of Ozo for the title screen.
export const portraitURL = () => spriteURL('ozo-idle', 8)
