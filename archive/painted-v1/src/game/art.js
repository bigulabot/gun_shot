// Original, code-drawn artwork. Textures are baked once and reused by Phaser.
const TAU = Math.PI * 2
const ellipse = (c, x, y, rx, ry, fill, angle = 0) => {
  c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fillStyle = fill; c.fill()
}
const path = (c, points, fill, stroke, width = 3) => {
  c.beginPath(); points(c); c.closePath(); c.fillStyle = fill; c.fill()
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke() }
}
function gradient(c, x, y, x2, y2, colors) {
  const g = c.createLinearGradient(x, y, x2, y2)
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color))
  return g
}
function texture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  draw(canvas.getContext('2d'))
  scene.textures.addCanvas(key, canvas)
}

function leaf(c, x, y, size, angle, color) {
  c.save(); c.translate(x, y); c.rotate(angle)
  path(c, p => { p.moveTo(0, 0); p.bezierCurveTo(-size * 0.45, -size * 0.4, -size * 0.35, -size, 0, -size); p.bezierCurveTo(size * 0.65, -size * 0.8, size * 0.55, -size * 0.2, 0, 0) }, color)
  c.strokeStyle = '#ecffe72a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -size * 0.84); c.stroke(); c.restore()
}

function ozo(c, frame, stride = 0) {
  const step = stride
  // Tail, orange legs and generous feet make the silhouette readable on a phone.
  path(c, p => { p.moveTo(41, 78); p.lineTo(10, 79); p.lineTo(22, 94); p.lineTo(48, 93) }, '#173b51', '#16384b')
  c.strokeStyle = '#e88836'; c.lineWidth = 7; c.lineCap = 'round'
  for (const [x, direction] of [[48, 1], [67, -1]]) {
    c.beginPath(); c.moveTo(x, 97); c.lineTo(x + step * direction, frame === 3 ? 108 : 115); c.stroke()
    ellipse(c, x + 4 + step * direction, frame === 3 ? 108 : 117, 13, 4, '#ffb84a')
  }
  ellipse(c, 55, 73, 28, 35, gradient(c, 24, 45, 83, 99, ['#285b76', '#122e43']))
  ellipse(c, 67, 74, 16, 29, '#fff6ce', -0.1)
  path(c, p => { p.moveTo(33, 60); p.bezierCurveTo(20, 75, 31, 98, 49, 94); p.bezierCurveTo(61, 90, 54, 77, 33, 60) }, '#30647d')
  c.strokeStyle = '#468699'; c.lineWidth = 3; c.beginPath(); c.moveTo(34, 75); c.lineTo(43, 86); c.stroke()
  ellipse(c, 57, 39, 27, 27, gradient(c, 30, 14, 78, 61, ['#255874', '#102d42']))
  path(c, p => { p.moveTo(42, 19); p.quadraticCurveTo(34, 1, 49, 8); p.lineTo(55, 17); p.quadraticCurveTo(63, 1, 67, 13); p.lineTo(66, 22) }, '#244e68')
  ellipse(c, 68, 42, 17, 21, '#fff7da')
  // The toucan's oversized beak: citrus yellow, orange base, pink tip.
  path(c, p => { p.moveTo(72, 29); p.bezierCurveTo(94, 14, 126, 22, 124, 40); p.bezierCurveTo(122, 51, 94, 57, 73, 48) }, gradient(c, 80, 24, 109, 56, ['#ffec6d', '#ffc049', '#fc793d']), '#cc6936', 2)
  path(c, p => { p.moveTo(114, 24); p.quadraticCurveTo(133, 33, 117, 46); p.quadraticCurveTo(108, 35, 114, 24) }, '#ed6470')
  c.strokeStyle = '#d67539'; c.lineWidth = 2; c.beginPath(); c.moveTo(79, 43); c.quadraticCurveTo(98, 47, 118, 40); c.stroke()
  ellipse(c, 67, 34, 6, 8, '#163244'); ellipse(c, 69, 31, 2, 2.5, '#ffffff')
  ellipse(c, 63, 48, 5, 3, '#ffba83')
  // A small toy-like pop blaster, with a glowing mint muzzle.
  c.save(); c.translate(76, 77)
  c.fillStyle = '#315873'; c.beginPath(); c.roundRect(-2, -7, 35, 16, 6); c.fill()
  c.fillStyle = '#f9bb53'; c.beginPath(); c.roundRect(3, 2, 9, 14, 3); c.fill()
  c.fillStyle = '#a2f8d4'; c.beginPath(); c.roundRect(27, -10, 9, 21, 4); c.fill()
  ellipse(c, 9, -1, 5, 5, '#69d9c8'); c.restore()
}

function enemy(c, ranged) {
  const outline = '#403253'
  ellipse(c, 49, 89, 32, 5, '#153b4430')
  for (const x of [29, 65]) {
    c.fillStyle = ranged ? '#8872ac' : '#398c85'; c.beginPath(); c.roundRect(x - 4, 68, 9, 18, 4); c.fill()
    ellipse(c, x + 4, 85, 13, 5, ranged ? '#b4a3cf' : '#70d6b5')
  }
  ellipse(c, 47, 55, 33, 29, gradient(c, 12, 27, 74, 85, ranged ? ['#cf94d1', '#93669f', '#634a82'] : ['#8be8bf', '#3da496', '#2b747b']))
  path(c, p => { p.moveTo(13, 40); p.bezierCurveTo(18, 7, 74, 5, 83, 38); p.quadraticCurveTo(48, 51, 13, 40) }, gradient(c, 30, 10, 52, 43, ranged ? ['#ffbfce', '#e780b2', '#a75d92'] : ['#fff195', '#ffc766', '#f09454']), outline, 2)
  ellipse(c, 34, 22, 7, 4, '#fff3c9'); ellipse(c, 64, 29, 6, 4, '#fff3c9')
  for (const x of [36, 59]) { ellipse(c, x, 54, 8, 10, '#fff8d9'); ellipse(c, x + 1, 56, 3.5, 5, outline) }
  if (ranged) {
    ellipse(c, 49, 71, 11, 10, '#ed9dc9'); ellipse(c, 49, 70, 6, 5, '#624471')
  } else {
    c.strokeStyle = '#235964'; c.lineWidth = 3; c.beginPath(); c.arc(48, 63, 8, 0.15, Math.PI - 0.15); c.stroke()
  }
}

function heart(c) {
  path(c, p => { p.moveTo(32, 55); p.bezierCurveTo(19, 44, 3, 33, 5, 20); p.bezierCurveTo(7, 3, 27, 3, 32, 17); p.bezierCurveTo(40, 1, 59, 6, 60, 22); p.bezierCurveTo(60, 36, 42, 48, 32, 55) }, gradient(c, 20, 5, 40, 55, ['#ffb0c0', '#ff6689', '#d63f78']), '#fff3d4', 3)
  ellipse(c, 17, 17, 4, 6, '#fff5e89c', 0.6)
}

export function createArt(scene) {
  // Double-resolution textures keep the rounded artwork crisp while moving.
  for (const i of [0, 3]) texture(scene, `ozo-${i}`, 256, 256, c => { c.scale(2, 2); ozo(c, i) })
  for (let i = 0; i < 8; i++) texture(scene, `ozo-run-${i}`, 256, 256, c => { c.scale(2, 2); ozo(c, 0, Math.sin(i * TAU / 8) * 8) })
  texture(scene, 'ozo-portrait', 768, 768, c => { c.scale(6, 6); ozo(c, 0) })
  texture(scene, 'snapper', 96, 96, c => enemy(c, false))
  texture(scene, 'spitter', 96, 96, c => enemy(c, true))
  texture(scene, 'heart', 64, 64, heart)
  for (let i = 0; i < 2; i++) texture(scene, `heart-${i}`, 64, 64, c => {
    c.beginPath(); c.moveTo(i ? 64 : 0, 0); c.lineTo(32, 0); c.lineTo(27, 21); c.lineTo(37, 29); c.lineTo(27, 39); c.lineTo(32, 64); c.lineTo(i ? 64 : 0, 64); c.closePath(); c.clip(); heart(c)
  })
  texture(scene, 'coin', 40, 40, c => {
    ellipse(c, 20, 22, 16, 16, '#b16d30'); ellipse(c, 20, 18, 16, 16, gradient(c, 8, 3, 30, 32, ['#fff89e', '#ffc94f', '#fca044']))
    c.strokeStyle = '#db8f35'; c.lineWidth = 2; c.beginPath(); c.arc(20, 18, 11, 0, TAU); c.stroke()
    c.strokeStyle = '#fff6b1'; c.lineWidth = 4; c.beginPath(); c.moveTo(21, 10); c.lineTo(16, 19); c.lineTo(24, 19); c.lineTo(19, 27); c.stroke()
  })
  texture(scene, 'research', 40, 44, c => {
    path(c, p => { p.moveTo(20, 2); p.lineTo(36, 16); p.lineTo(30, 33); p.lineTo(20, 42); p.lineTo(6, 30); p.lineTo(4, 15) }, '#81f2e0', '#dcfff1', 2)
    path(c, p => { p.moveTo(20, 2); p.lineTo(21, 21); p.lineTo(4, 15) }, '#d8fff0')
    path(c, p => { p.moveTo(21, 21); p.lineTo(36, 16); p.lineTo(20, 42) }, '#3bbfae')
  })
  texture(scene, 'pop', 28, 16, c => {
    ellipse(c, 14, 8, 13, 7, '#6bfff09a'); ellipse(c, 17, 8, 9, 5, '#faffc4'); ellipse(c, 19, 6, 4, 2, '#ffffff')
  })
  texture(scene, 'enemy-pop', 24, 24, c => { ellipse(c, 12, 12, 11, 11, '#e96d96'); ellipse(c, 11, 10, 7, 7, '#ffacc5'); ellipse(c, 8, 7, 3, 3, '#fff5e7') })
  texture(scene, 'spark', 24, 24, c => path(c, p => { p.moveTo(12, 0); p.lineTo(15, 9); p.lineTo(24, 12); p.lineTo(15, 15); p.lineTo(12, 24); p.lineTo(9, 15); p.lineTo(0, 12); p.lineTo(9, 9) }, '#fff6ba'))
  texture(scene, 'dust', 16, 16, c => ellipse(c, 8, 8, 8, 8, '#e7ffe6'))
  texture(scene, 'switch', 90, 90, c => {
    ellipse(c, 45, 48, 40, 40, '#376f65'); ellipse(c, 45, 42, 37, 37, '#e3cb84'); ellipse(c, 45, 42, 29, 29, '#b8904c')
    for (let i = 0; i < 8; i++) {
      c.save(); c.translate(45, 42); c.rotate(i * TAU / 8); c.fillStyle = '#fff5bc'; c.beginPath(); c.roundRect(-3, -25, 6, 9, 2); c.fill(); c.restore()
    }
    ellipse(c, 45, 42, 12, 12, '#ffdd69'); ellipse(c, 42, 39, 4, 4, '#fff5c6')
  })
  texture(scene, 'palm', 260, 310, c => {
    path(c, p => { p.moveTo(134, 310); p.quadraticCurveTo(103, 160, 119, 83); p.lineTo(137, 81); p.quadraticCurveTo(126, 209, 154, 310) }, gradient(c, 105, 80, 150, 280, ['#3a948c', '#4eb397', '#338c82']))
    for (let i = 0; i < 9; i++) leaf(c, 129, 85, 90 + (i % 3) * 20, -2.05 + i * 0.52, ['#2b9c8c', '#43b895', '#6ad8a5'][i % 3])
    ellipse(c, 124, 100, 11, 16, '#f5bf67'); ellipse(c, 140, 104, 10, 14, '#edaa62')
  })
  texture(scene, 'bush', 230, 130, c => {
    for (let i = 0; i < 9; i++) leaf(c, 115 + Math.sin(i * 5) * 40, 133, 70 + (i % 4) * 20, -1.25 + i * 0.31, ['#217d78', '#359f86', '#72ce9b'][i % 3])
    for (let i = 0; i < 3; i++) { ellipse(c, 45 + i * 54, 78 + i * 9, 5, 8, '#ffbc79', i); ellipse(c, 52 + i * 54, 70 + i * 9, 5, 8, '#f58b99', -i) }
  })
  texture(scene, 'flower', 80, 110, c => {
    c.strokeStyle = '#388574'; c.lineWidth = 6; c.beginPath(); c.moveTo(43, 110); c.quadraticCurveTo(31, 68, 40, 35); c.stroke()
    leaf(c, 39, 83, 32, -0.85, '#67c594'); leaf(c, 39, 68, 33, 0.8, '#94dbaa')
    for (let i = 0; i < 5; i++) ellipse(c, 40 + Math.cos(i * TAU / 5) * 15, 29 + Math.sin(i * TAU / 5) * 15, 12, 17, '#fa91ab', i * TAU / 5 - 1.55)
    ellipse(c, 40, 29, 10, 10, '#ffe599')
  })
  texture(scene, 'sky', 1280, 720, c => {
    c.fillStyle = gradient(c, 0, 0, 0, 720, ['#daf2d1', '#a8ddd0', '#65bebe']); c.fillRect(0, 0, 1280, 720)
    const halo = c.createRadialGradient(978, 135, 10, 978, 135, 280); halo.addColorStop(0, '#fffbcbbb'); halo.addColorStop(1, '#fffbc000'); c.fillStyle = halo; c.fillRect(650, 0, 630, 520)
    ellipse(c, 979, 137, 52, 52, '#fff8ce')
    c.fillStyle = '#f6ffd720'; path(c, p => { p.moveTo(970, 110); p.lineTo(520, 720); p.lineTo(840, 720); p.lineTo(1010, 110) }, '#ffffdc20')
    for (const [x, y, s] of [[180, 115, 1], [720, 185, 0.7], [1170, 270, 0.8]]) {
      ellipse(c, x, y, 85 * s, 17 * s, '#f6ffe78a'); ellipse(c, x - 20 * s, y - 13 * s, 40 * s, 22 * s, '#f6ffe78a')
    }
  })
  for (let layer = 0; layer < 2; layer++) texture(scene, `jungle-${layer}`, 1600, 720, c => {
    const base = layer ? 470 : 360
    path(c, p => {
      p.moveTo(0, 720); p.lineTo(0, base)
      for (let x = 0; x < 1600; x += 200) p.bezierCurveTo(x + 20, base - 130 - Math.sin(x) * 70, x + 145, base - 160, x + 200, base)
      p.lineTo(1600, 720)
    }, gradient(c, 0, base - 150, 0, 700, layer ? ['#58aaa4', '#81c6b3'] : ['#83bdb3', '#9bcec0']))
    for (let i = 0; i < 13; i++) {
      const x = i * 137 + 38; const y = base + 40 + Math.sin(i * 1.8) * 70
      c.strokeStyle = layer ? '#479a9566' : '#65a99f88'; c.lineWidth = 9; c.beginPath(); c.moveTo(x, y + 180); c.quadraticCurveTo(x - 15, y + 70, x, y); c.stroke()
      for (let j = 0; j < 5; j++) leaf(c, x, y, 50 + j * 7, (j - 2) * 0.7, layer ? '#4d9f98aa' : '#77b1a4aa')
    }
  })
}

export function terrainTexture(scene, width, height, floating = false) {
  const key = `terrain-${width}-${height}-${floating}`
  texture(scene, key, width + 8, height + 22, c => {
    c.fillStyle = gradient(c, 0, 8, 0, height, ['#efb66e', '#c87b65', '#8e596a'])
    c.beginPath(); c.roundRect(4, 13, width, height, floating ? [12, 12, 26, 26] : [12, 12, 10, 10]); c.fill()
    c.save(); c.beginPath(); c.roundRect(4, 13, width, height, 12); c.clip()
    path(c, p => { p.moveTo(0, 55); for (let x = 0; x <= width + 50; x += 55) p.lineTo(x, 55 + Math.sin(x * 0.026) * 12); p.lineTo(width + 20, 94); p.lineTo(0, 103) }, '#ffd49355')
    for (let i = 0; i < width / 38; i++) {
      const x = 18 + i * 39; const y = 74 + ((i * 47) % Math.max(25, height - 90))
      ellipse(c, x, y, 8 + i % 7, 4 + i % 4, i % 2 ? '#7d496b25' : '#ffe2a138', 0.3)
    }
    c.restore()
    c.fillStyle = '#1d696c55'; c.beginPath(); c.roundRect(4, 22, width, 15, 7); c.fill()
    c.fillStyle = gradient(c, 0, 0, 0, 31, ['#d9f2a2', '#86cf8c', '#4ba68c']); c.beginPath(); c.roundRect(0, 6, width + 8, 24, 10); c.fill()
    for (let i = 5; i < width; i += 24) {
      path(c, p => { p.moveTo(i, 10); p.lineTo(i + 5, 0); p.lineTo(i + 9, 11); p.lineTo(i + 17, 3); p.lineTo(i + 14, 14) }, i % 3 ? '#b6e898' : '#ddf8b5')
    }
  })
  return key
}
