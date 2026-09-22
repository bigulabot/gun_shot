// One-off generator for the home-screen / PWA icons, built from Ozo's own
// placeholder pixel art so the icon matches the game exactly. Pure Node,
// no dependencies: writes 8-bit RGB PNGs by hand with zlib for the IDAT.
// Run with: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { SPRITES, PALETTE } from '../src/game/sprites.js'

const INK = [0x10, 0x20, 0x2c] // --ink, the game's background colour

function crc(buf) {
  // Node has no public crc32 in older versions; implement the standard table-based CRC32.
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  // Raw scanlines, each prefixed with a filter-type byte (0 = none).
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Draws the sprite (a grid of palette-letter rows) onto a square canvas of
// `size` px, filled with the ink background, scaled up by `scale`.
function makeIcon(size, scale, pad = 0.03) {
  const rows = SPRITES['ozo-idle']
  // Centre on the drawn pixels, not the full (padded) grid width, so Ozo
  // doesn't look shoved off to one side.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  rows.forEach((row, y) => [...row].forEach((letter, x) => {
    if (letter === '.' || !PALETTE[letter]) return
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }))
  const spriteW = maxX - minX + 1, spriteH = maxY - minY + 1
  const w = spriteW * scale, h = spriteH * scale
  const ox = Math.round((size - w) / 2) - minX * scale, oy = Math.round((size - h) / 2) - minY * scale + Math.round(size * pad)
  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = INK[0]; rgba[i * 4 + 1] = INK[1]; rgba[i * 4 + 2] = INK[2]; rgba[i * 4 + 3] = 255
  }
  rows.forEach((row, ry) => {
    const y0 = Math.round(oy + ry * scale), y1 = Math.round(oy + (ry + 1) * scale)
    ;[...row].forEach((letter, rx) => {
      if (letter === '.' || !PALETTE[letter]) return
      const [r, g, b] = hexToRGB(PALETTE[letter])
      const x0 = Math.round(ox + rx * scale), x1 = Math.round(ox + (rx + 1) * scale)
      // Round each cell's own edges (not just its size) so a non-integer
      // scale still tiles without gaps or overlaps between cells.
      for (let y = y0; y < y1; y++) {
        if (y < 0 || y >= size) continue
        for (let x = x0; x < x1; x++) {
          if (x < 0 || x >= size) continue
          const i = (y * size + x) * 4
          rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255
        }
      }
    })
  })
  return encodePNG(size, size, rgba)
}

mkdirSync('public/icons', { recursive: true })
const targets = [[512, 16], [192, 6], [180, 5.6], [32, 1]]
for (const [size, scale] of targets) {
  const buf = makeIcon(size, scale)
  writeFileSync(`public/icons/icon-${size}.png`, buf)
  console.log(`wrote public/icons/icon-${size}.png (${buf.length} bytes)`)
}
