// Shared by the scripts that turn the letter grids in sprites.js into PNG
// files. Pure Node, no dependencies: writes 8-bit RGBA PNGs by hand, with
// zlib for the pixel data.
import { deflateSync } from 'node:zlib'
import { PALETTE } from '../src/game/sprites.js'

function crc(buf) {
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

export function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// A blank image: filled with a '#rrggbb' colour, or transparent.
export function canvas(width, height, fill = null) {
  const rgba = Buffer.alloc(width * height * 4)
  if (fill) {
    const [r, g, b] = hexToRGB(fill)
    for (let i = 0; i < width * height; i++) rgba.set([r, g, b, 255], i * 4)
  }
  return { width, height, rgba }
}

export function fillRect(image, x0, y0, x1, y1, hex) {
  const [r, g, b] = hexToRGB(hex)
  for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x++) image.rgba.set([r, g, b, 255], (y * image.width + x) * 4)
  }
}

// The drawn (non-'.') pixels of a sprite, in art pixels.
export function bounds(rows) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  rows.forEach((row, y) => [...row].forEach((letter, x) => {
    if (letter === '.' || !PALETTE[letter]) return
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }))
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

// Draws a sprite with its top-left art pixel at (x, y), each art pixel
// `scale` px across. Each cell's own edges are rounded (not just its size),
// so a non-whole scale still tiles without gaps or overlaps.
export function drawRows(image, rows, x, y, scale) {
  rows.forEach((row, ry) => {
    const y0 = Math.round(y + ry * scale), y1 = Math.round(y + (ry + 1) * scale)
    ;[...row].forEach((letter, rx) => {
      if (letter === '.' || !PALETTE[letter]) return
      fillRect(image, Math.round(x + rx * scale), y0, Math.round(x + (rx + 1) * scale), y1, PALETTE[letter])
    })
  })
}

export function encodePNG({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  // Raw scanlines, each starting with a filter-type byte (0 = none).
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
