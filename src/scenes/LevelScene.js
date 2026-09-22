import Phaser from 'phaser'
import { createArt, portraitURL } from '../game/art.js'
import { PX, SPRITES } from '../game/sprites.js'
import { state, emit, setMode, collect, beginRun, bankRun, loseRun } from '../game/state.js'
import { sound } from '../game/audio.js'
import { bodySweep, sweep, rangeEnd, canLandOnPlatform, shotRange, ENEMY_SHOT_RANGE } from '../game/combat.js'
import { PLAYER, BLASTER, ENEMIES, WALL, LOOT, CAMERA } from '../game/tuning.js'
import canopy from '../levels/canopy.js'

const STONE_WIDTH = 50, STONE_HEIGHT = 44 // wall stones, world pixels
const GROUND_DEPTH = 210 // ground reaches below the bottom of the screen
const MUZZLE_X = 42, MUZZLE_Y = 28 // where shots leave the blaster, from Ozo's feet
const MONKEY_GRIP = { x: 5.5, y: 14 } // art pixel under the left palm frond where a monkey holds on
const MONKEY_HAND = 10 // the monkey's hand, in art pixels from the left of its sprite
const FONT = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontStyle: 'bold' }
const clamp = Phaser.Math.Clamp, between = Phaser.Math.Between
const TOUCH = window.matchMedia?.('(pointer: coarse)').matches // phone or tablet: show touch tips

// Arcade bodies are sized in unscaled texture pixels; this takes world pixels,
// centres the box on the sprite and puts its bottom on the sprite's origin (the feet).
function feetBody(sprite, width, height) {
  const w = width / sprite.scaleX, h = height / sprite.scaleY
  sprite.body.setSize(w, h, false).setOffset(sprite.width * sprite.originX - w / 2, sprite.height * sprite.originY - h)
}

export class LevelScene extends Phaser.Scene {
  constructor() { super('LevelScene') }

  create(data = {}) {
    const L = this.level = data.level ?? canopy
    // Starting again from the checkpoint, or from the very beginning (which forgets it).
    const saved = data.fromCheckpoint && L.checkpoint ? state.checkpoint : null
    if (!saved) state.checkpoint = null
    const after = x => !saved || x > L.checkpoint // things behind the checkpoint are already done
    createArt(this)
    this.time.paused = false
    this.playTime = saved?.playTime ?? 0
    this.facing = 1
    this.lastGround = -1000
    this.jumpBuffer = -1000
    this.rising = false
    this.shotAt = 0
    this.hurtUntil = 0
    this.knockUntil = 0
    this.dashUntil = 0
    this.dashReady = 0
    this.wallBroken = false
    this.runStride = 0
    this.finished = false
    this.lastHudTick = -1
    this.lastDashTrail = -1
    this.shotsFired = 0
    this.jumpsMade = 0
    this.loadout = { ...state.profile.upgrades, equipped: state.profile.equipped }
    state.health = PLAYER.hearts
    beginRun(L.enemies.length, Boolean(data.autostart))
    if (saved) { Object.assign(state.run, { coins: saved.coins, research: saved.research, defeated: saved.defeated }); emit('profile') }
    this.physics.world.setBounds(0, -200, L.width, 1150)
    this.physics.world.setBoundsCollision(true, true, false, false)
    this.cameras.main.setBounds(0, 0, L.width, 720)
    this.drawBackground()

    this.platforms = this.physics.add.staticGroup()
    for (const [x, width] of L.ground) this.addPlatform(x, L.floor, width, GROUND_DEPTH)
    this.drawPits()
    for (const [x, y, width, height = 25] of L.ledges) this.addPlatform(x, y, width, height, true)
    for (const [x, y, text, touchText] of L.tips) this.tip(x, y, TOUCH && touchText ? touchText : text)
    this.createWall(Boolean(saved))
    this.createCheckpoint(Boolean(saved))
    this.createExit()

    this.hero = this.physics.add.sprite(saved ? L.checkpoint : L.start, L.floor - 2, 'ozo-idle').setOrigin(0.5, 17 / 18).setScale(PX).setDepth(20)
    feetBody(this.hero, PLAYER.bodyWidth, PLAYER.bodyHeight)
    this.hero.setCollideWorldBounds(true)
    this.hero.body.setMaxVelocity(1000, PLAYER.maxFallSpeed)
    this.glider = this.add.image(0, 0, 'glider').setScale(PX).setDepth(19).setVisible(false)

    this.enemies = this.physics.add.group()
    for (const [x, type, min, max] of L.enemies) if (after(x)) this.createEnemy(x, type, min, max)
    this.shots = this.physics.add.group({ allowGravity: false, maxSize: 50 })
    this.enemyShots = this.physics.add.group({ allowGravity: false, maxSize: 24 })
    this.loot = this.physics.add.group({ allowGravity: false })
    for (const [x, y, kind] of L.pickups) if (after(x)) this.createLoot(x, y, kind)

    this.physics.add.collider(this.hero, this.platforms, undefined, (hero, platform) => canLandOnPlatform(hero.body, platform))
    this.physics.add.collider(this.hero, this.wallCollider)
    this.physics.add.collider(this.enemies, this.platforms)
    this.physics.add.overlap(this.hero, this.enemies, (_, enemy) => this.hurt(enemy.x))
    this.physics.add.overlap(this.hero, this.loot, (_, loot) => this.takeLoot(loot))
    // Resolve projectile events in travel order after each physics step. There
    // are no group-vs-single callbacks that can mistake a wall for a bullet.
    const world = this.physics.world
    world.on('worldstep', this.resolveProjectiles, this)
    world.on('worldstep', this.shortHop, this)
    this.events.once('shutdown', () => { world.off('worldstep', this.resolveProjectiles, this); world.off('worldstep', this.shortHop, this) })
    // The camera looks ahead of Ozo in the direction he faces.
    this.cameraLead = -CAMERA.lookAhead
    this.cameras.main.startFollow(this.hero, true, 1, 0)
    this.cameras.main.setFollowOffset(this.cameraLead, 0)
    // A red flash over the screen when Ozo gets hurt.
    this.hurtFlash = this.add.rectangle(0, 0, 1280, 720, 0xff3355).setOrigin(0).setScrollFactor(0).setDepth(50).setAlpha(0)
    this.physics.pause()
    setMode(data.autostart ? 'playing' : 'title')
    if (data.autostart) this.physics.resume()
    emit('level', { id: L.id, name: L.name })
    emit('ready', portraitURL())
    emit('health', state.health)
    emit('progress', saved ? (L.checkpoint - L.start) / (L.exit - L.start) : 0)
    emit('objective', saved ? 'Path clear. Head home!' : 'Find the crumbling wall')
  }

  startRun() { this.scene.restart({ autostart: true, level: this.level }) }
  restartFromCheckpoint() { this.scene.restart({ autostart: true, level: this.level, fromCheckpoint: true }) }
  goHome() { this.scene.restart({ autostart: false, level: this.level }) }
  pauseRun() {
    if (state.mode !== 'playing') return
    this.freeze(true); setMode('paused')
  }
  resumeRun() {
    if (state.mode !== 'paused') return
    setMode('playing'); this.freeze(false)
  }
  // Pausing stops physics, timers and effects together.
  freeze(frozen) {
    if (frozen) { this.physics.pause(); this.tweens.pauseAll() } else { this.physics.resume(); this.tweens.resumeAll() }
    this.time.paused = frozen
  }

  drawBackground() {
    // Three layers of jungle, each moving slower than the level the further away it is.
    // A layer moving at `speed` must cover the screen plus that share of the level.
    const L = this.level, cover = speed => 1280 + L.width * speed
    const farWidth = 64 * PX * 2
    for (let x = -300; x < cover(0.12); x += farWidth) { // faint, farthest trees
      this.add.image(x, L.floor - 80, 'jungle-far').setOrigin(0, 1).setScale(PX * 2).setScrollFactor(0.12).setDepth(-13).setFlipX(true).setAlpha(0.45)
    }
    for (let x = 0; x < cover(0.25); x += farWidth) {
      this.add.image(x, L.floor + 16, 'jungle-far').setOrigin(0, 1).setScale(PX * 2).setScrollFactor(0.25).setDepth(-12)
    }
    // Palms and bushes: spread out unevenly, but the same every time.
    for (let i = 0, x = 60; x < cover(0.5); i++, x += 230 + (i * 97) % 190) {
      this.add.image(x, L.floor + 12, 'palm').setOrigin(0.5, 1).setScale(PX).setScrollFactor(0.5).setDepth(-11).setFlipX(i % 2 === 1)
      this.add.image(x + 90 + (i * 53) % 80, L.floor + 6, 'bush').setOrigin(0.5, 1).setScale(PX).setScrollFactor(0.5).setDepth(-11)
      // Every third palm has a monkey hanging by one hand under a frond,
      // swinging gently from that hand. Flipped palms get a flipped monkey
      // on the other frond, so it always dangles outwards. Drawn as a soft
      // dark-green silhouette so it stays in the background.
      if (i % 3 === 1) {
        const flip = i % 2 === 1, palmW = SPRITES.palm[0].length, palmH = SPRITES.palm.length
        const frondX = (MONKEY_GRIP.x - palmW / 2) * PX * (flip ? -1 : 1)
        const handX = MONKEY_HAND / SPRITES.monkey[0].length
        const monkey = this.add.image(x + frondX, L.floor + 12 - (palmH - MONKEY_GRIP.y) * PX, 'monkey')
          .setOrigin(flip ? 1 - handX : handX, 0).setScale(PX).setScrollFactor(0.5).setDepth(-10).setFlipX(flip)
          .setTint(0x3f7560).setTintMode(Phaser.TintModes.FILL).setAlpha(0.8)
        monkey.setAngle(-5)
        this.tweens.add({ targets: monkey, angle: 5, duration: 1700 + (i * 211) % 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
    }
    // Vines hanging from the treetops above the screen.
    for (let i = 0, x = 150; x < cover(0.8); i++, x += 330 + (i * 71) % 240) {
      this.add.image(x, -8 - (i % 3) * 24, 'vine').setOrigin(0.5, 0).setScale(PX).setScrollFactor(0.8).setDepth(-9)
    }
    this.drawBirds()
  }

  // A handful of tiny birds drifting lazily across the sky, far in the background.
  drawBirds() {
    const L = this.level, count = Math.max(4, Math.round(L.width / 900))
    for (let i = 0; i < count; i++) {
      const x = 250 + i * (L.width / count) + (i * 137) % 220
      const y = 70 + (i * 53) % 170
      const flap = between(320, 420)
      const bird = this.add.image(x, y, 'bird-a').setOrigin(0.5).setScale(PX * 1.4).setScrollFactor(0.3).setDepth(-10).setAlpha(0.65).setFlipX(i % 2 === 0)
      this.time.addEvent({ delay: flap, loop: true, callback: () => bird.setTexture(bird.texture.key === 'bird-a' ? 'bird-b' : 'bird-a') })
      const reach = between(140, 220)
      this.tweens.add({
        targets: bird, x: x + (bird.flipX ? -reach : reach), y: y + between(-15, 15),
        duration: between(7000, 11000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        onYoyo: () => bird.toggleFlipX(), onRepeat: () => bird.toggleFlipX(),
      })
    }
  }

  // Fill the gaps between pieces of ground with a dark hole, so pits never look like sky.
  drawPits() {
    const ground = [...this.level.ground].sort((a, b) => a[0] - b[0]), floor = this.level.floor
    for (let i = 0; i + 1 < ground.length; i++) {
      const start = ground[i][0] + ground[i][1], end = ground[i + 1][0]
      if (end <= start) continue
      this.add.rectangle(start, floor + PX, end - start, 5 * PX, 0x4a2e1c).setOrigin(0).setDepth(9)
      this.add.rectangle(start, floor + 6 * PX, end - start, 720, 0x3a2718).setOrigin(0).setDepth(9)
    }
  }

  addPlatform(x, y, width, height, oneWay = false) {
    if (oneWay) {
      // Always drawn as one plank, whatever the collision height.
      this.add.tileSprite(x, y, width, SPRITES.ledge.length * PX, 'ledge').setOrigin(0).setTileScale(PX).setDepth(10)
    } else {
      this.add.tileSprite(x, y, width, height, 'dirt').setOrigin(0).setTileScale(PX).setDepth(10)
      this.add.tileSprite(x, y, width, 3 * PX, 'grass').setOrigin(0).setTileScale(PX).setDepth(11)
    }
    const collider = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0, 0)
    this.physics.add.existing(collider, true)
    this.platforms.add(collider)
    collider.oneWay = oneWay
  }

  // A tutorial tip on a pixel cloud sized to fit the words.
  tip(x, y, text) {
    const label = this.add.text(x, y, text, { ...FONT, fontSize: '22px', color: '#10202c' }).setOrigin(0.5).setDepth(6)
    const snap = v => Math.round(v / PX) * PX
    const w = snap(label.width + 56), h = snap(label.height + 28), left = snap(x - w / 2), top = snap(y - h / 2)
    const g = this.add.graphics().setDepth(5)
    // A box with its corners stepped off, so it looks drawn in pixels.
    const puff = (bx, by, bw, bh, color) => g.fillStyle(color).fillRect(bx + PX, by, bw - 2 * PX, bh).fillRect(bx, by + PX, bw, bh - 2 * PX)
    // Every cloud is puffy on top; most also bulge underneath, with none, one
    // or two puffs (picked from its position, so it's the same each time).
    // Each puff below is [left, width] as shares of the cloud, and how many
    // art pixels it hangs down.
    const below = [[], [[0.22, 0.34, 4]], [[0.12, 0.3, 4], [0.56, 0.28, 3]]][Math.floor(x / 10) % 3]
      .map(([fx, fw, drop]) => [left + snap(w * fx), top + h - 4 * PX, snap(w * fw), (4 + drop) * PX])
    for (const [bx, by, bw, bh] of [[left, top, w, h], ...below]) puff(bx + PX, by + 2 * PX, bw, bh, 0xc9e3ee) // shadows
    puff(left + snap(w * 0.1), top - 4 * PX, snap(w * 0.32), 8 * PX, 0xffffff)
    puff(left + snap(w * 0.48), top - 7 * PX, snap(w * 0.3), 10 * PX, 0xffffff)
    for (const [bx, by, bw, bh] of below) puff(bx, by, bw, bh, 0xffffff)
    puff(left, top, w, h, 0xffffff)
  }

  createWall(broken = false) {
    const { x, columns, rows } = this.level.wall, floor = this.level.floor
    this.wallHp = broken ? 0 : WALL.health
    this.wallBroken = broken
    this.wallBlocks = []
    if (!broken) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      this.wallBlocks.push(this.add.image(x + col * STONE_WIDTH + 1, floor - (rows - row) * STONE_HEIGHT, 'stone-0').setOrigin(0).setScale(PX).setDepth(14))
    }
    const width = columns * STONE_WIDTH, height = rows * STONE_HEIGHT
    this.wallCollider = this.add.rectangle(x + width / 2, floor - height / 2, width, height, 0, 0)
    this.physics.add.existing(this.wallCollider, true)
    if (broken) this.wallCollider.body.enable = false
  }

  createCheckpoint(reached = false) {
    this.checkpointReached = reached
    if (!this.level.checkpoint) return
    this.flag = this.add.image(this.level.checkpoint, this.level.floor, reached ? 'flag-up' : 'flag-down').setOrigin(0.3, 1).setScale(PX).setDepth(9)
  }

  reachCheckpoint() {
    this.checkpointReached = true
    state.checkpoint = { playTime: this.playTime, coins: state.run.coins, research: state.run.research, defeated: state.run.defeated }
    this.flag.setTexture('flag-up')
    this.burst(this.flag.x + 16, this.flag.y - 80, 10, 0xef4f6a)
    sound('heal')
    emit('toast', 'Checkpoint! If Ozo falls, he starts again here.')
  }

  hitWall(bullet) {
    if (this.wallBroken || !bullet.active) return
    const { x, columns, rows } = this.level.wall, floor = this.level.floor
    this.wallHp = Math.max(0, this.wallHp - bullet.damage)
    this.popBullet(bullet)
    const damage = WALL.health - this.wallHp
    const removedRows = this.wallHp === 0 ? rows : Math.min(rows - 1, Math.floor(damage / WALL.healthPerRow))
    const cracks = Math.min(2, Math.floor((damage % WALL.healthPerRow) * 3 / WALL.healthPerRow))
    this.wallBlocks.forEach((block, i) => {
      if (block.falling) return
      if (Math.floor(i / columns) >= removedRows) { block.setTexture(`stone-${cracks}`); return }
      block.falling = true
      this.tweens.add({ targets: block, x: block.x + (i % 2 ? 60 : -60), y: block.y + 120, angle: i % 2 ? 35 : -35, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => block.destroy() })
    })
    const width = columns * STONE_WIDTH, height = (rows - removedRows) * STONE_HEIGHT
    if (height) {
      // The collider shrinks with the missing stones, but stays solid until broken.
      this.wallCollider.setSize(width, height).setPosition(x + width / 2, floor - height / 2)
      this.wallCollider.body.setSize(width, height).updateFromGameObject()
      this.burst(x, Math.min(floor - 15, bullet.impactY ?? floor - 40), 5, 0xe6d2ae, 0.6)
      return
    }
    this.wallBroken = true
    this.wallCollider.body.enable = false
    this.burst(x + width / 2, floor - 65, 24, 0xe6d2ae, 1.4)
    this.floatText(x + width / 2, floor - 150, 'WALL DOWN!')
    sound('switch')
    emit('objective', 'Path clear. Head home!')
    emit('toast', 'Wall down! Keep heading right.')
  }

  createExit() {
    const x = this.level.exit, floor = this.level.floor
    this.house = this.add.image(x, floor, 'home').setOrigin(0.5, 1).setScale(PX).setDepth(9)
    this.doorway = { x, y: floor - 54 } // centre of the round hole in the birdhouse
    this.add.rectangle(x, this.doorway.y, 6 * PX, 5 * PX, 0x10202c).setDepth(8) // the dark inside
    this.add.text(x, floor - 24 * PX - 24, 'HOME', { ...FONT, fontSize: '20px', color: '#10202c' }).setOrigin(0.5).setDepth(11)
  }

  createEnemy(x, type, min, max) {
    const enemy = this.physics.add.sprite(x, this.level.floor, type).setOrigin(0.5, 1).setScale(PX).setDepth(18)
    this.enemies.add(enemy)
    feetBody(enemy, 53, 63)
    const health = ENEMIES[type].health
    Object.assign(enemy, { kind: type, hp: health, maxHp: health, patrolMin: min, patrolMax: max, direction: -1, fireAt: this.playTime + 1300 + x % 700, warning: false, stunnedUntil: 0 })
    enemy.healthBar = this.add.graphics().setDepth(25)
    enemy.alert = this.add.image(x, 0, 'alert').setScale(PX).setDepth(25).setVisible(false)
    this.drawEnemyHealth(enemy)
    return enemy
  }

  // Pickups stay where they are put; only coins and research drift to Ozo when he is very close.
  createLoot(x, y, kind) {
    const loot = this.loot.create(x, y, { coins: 'coin', research: 'research', heart: 'heart' }[kind]).setScale(PX).setDepth(24)
    loot.kind = kind
    loot.body.setSize(18 / PX, 20 / PX, true)
    loot.magnet = false
  }

  takeLoot(loot) {
    if (!loot.active || state.mode !== 'playing') return
    if (loot.kind === 'heart') {
      if (state.health >= PLAYER.hearts) return // saved for when Ozo is hurt
      state.health++
      emit('health', state.health)
      emit('toast', 'A heart came back!')
      sound('heal')
      this.burst(loot.x, loot.y, 10, 0xff5a7a)
    } else {
      collect(loot.kind)
      sound(loot.kind === 'coins' ? 'coin' : 'research')
      this.burst(loot.x, loot.y, 4, loot.kind === 'coins' ? 0xffd23f : 0x7ef2df)
    }
    loot.destroy()
  }

  // Used by the blaster, the spitters and the verification fixtures.
  spawnShot(incoming, x, y, vx, vy = 0) {
    const shot = (incoming ? this.enemyShots : this.shots).create(x, y, incoming ? 'enemy-pop' : 'pop')
    if (!shot) return null
    shot.setScale(PX).setDepth(incoming ? 21 : 22).setFlipX(vx < 0)
    shot.body.setAllowGravity(false)
    shot.body.setSize((incoming ? 18 : 22) / PX, (incoming ? 18 : 12) / PX, true)
    shot.setVelocity(vx, vy)
    shot.damage = BLASTER.damage
    shot.range = incoming ? ENEMY_SHOT_RANGE : shotRange(this.loadout.range)
    shot.travelled = 0
    // Range normally ends a shot; this is only a safety net.
    shot.expires = this.playTime + shot.range / Math.max(1, Math.hypot(vx, vy)) * 1000 + 500
    return shot
  }

  shoot() {
    const fire = () => {
      if (state.mode !== 'playing') return
      const bullet = this.spawnShot(false, this.hero.x + this.facing * MUZZLE_X, this.hero.y - MUZZLE_Y, this.facing * BLASTER.shotSpeed)
      if (!bullet) return
      this.shotsFired++
      bullet.damage = this.loadout.power ? BLASTER.popPowerDamage : BLASTER.damage
      sound('shoot')
      this.burst(bullet.x, bullet.y, 2, 0xdffff0, 0.4)
    }
    fire()
    if (this.loadout.equipped === 'twin') this.time.delayedCall(BLASTER.twinGap, fire)
  }

  popBullet(bullet) {
    if (!bullet.active) return
    this.burst(bullet.impactX ?? bullet.body.center.x, bullet.impactY ?? bullet.body.center.y, 3, 0xfff3ce, 0.35)
    bullet.destroy()
  }

  // Short hop: letting go of jump while rising cuts the jump short. Runs every
  // physics step, so a tap gives the same hop at any frame rate.
  shortHop(step) {
    if (!this.rising || state.mode !== 'playing') return
    const body = this.hero.body
    this.jumpTime += step * 1000
    if (body.velocity.y >= 0) { this.rising = false; return }
    if (!state.input.jump && this.jumpTime >= PLAYER.shortHopTime && body.velocity.y < -PLAYER.jumpCutVelocity) body.setVelocityY(-PLAYER.jumpCutVelocity)
  }

  resolveProjectiles() {
    if (state.mode !== 'playing') return
    const shots = this.shots.getChildren().filter(b => b.active)
    const incoming = this.enemyShots.getChildren().filter(b => b.active)
    const bullets = [...shots, ...incoming]
    const paths = new Map(bullets.map(b => [b, bodySweep(b.body)]))
    const events = []
    const addHit = (a, b, kind, priority = 1) => {
      const time = sweep(paths.get(a), paths.get(b) ?? bodySweep(b.body))
      if (time !== null) events.push({ time, a, b, kind, priority })
    }
    for (const bullet of bullets) {
      const path = paths.get(bullet)
      const distance = Math.hypot(path.x - path.prev.x, path.y - path.prev.y)
      const end = rangeEnd(bullet.travelled, distance, bullet.range)
      if (end !== null) events.push({ time: end, a: bullet, kind: 'expire', priority: -1 })
      bullet.travelled += distance
      for (const platform of this.platforms.getChildren()) addHit(bullet, platform, 'terrain')
      if (!this.wallBroken) addHit(bullet, this.wallCollider, shots.includes(bullet) ? 'wall' : 'terrain')
    }
    // Player shots and enemy shots pass through each other.
    for (const bullet of shots) for (const enemy of this.enemies.getChildren()) if (enemy.active) addHit(bullet, enemy, 'enemy')
    for (const bullet of incoming) addHit(bullet, this.hero, 'hero')
    // Whatever each shot reaches first wins; running out of range beats a hit at the same moment.
    events.sort((a, b) => a.time - b.time || a.priority - b.priority)
    for (const { time, a, b, kind } of events) {
      if (state.mode !== 'playing') break
      if (!a.active || (b && (!b.active || !b.body?.enable))) continue
      const path = paths.get(a)
      a.impactX = Phaser.Math.Linear(path.prev.x, path.x, time)
      a.impactY = Phaser.Math.Linear(path.prev.y, path.y, time)
      if (kind === 'wall') this.hitWall(a)
      else if (kind === 'enemy') this.hitEnemy(a, b)
      else if (kind === 'hero') { const from = a.impactX; this.popBullet(a); this.hurt(from) }
      else this.popBullet(a)
    }
  }

  // Redrawn only when health changes; update() just moves it.
  drawEnemyHealth(enemy) {
    const g = enemy.healthBar.clear(), width = 48, step = width / enemy.maxHp
    g.fillStyle(0x10202c).fillRect(-2, -2, width + 2, 8)
    for (let i = 0; i < enemy.maxHp; i++) g.fillStyle(i < enemy.hp ? 0xffd23f : 0x4a5a66).fillRect(i * step, 0, step - 2, 4)
  }

  hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || state.mode !== 'playing') return
    enemy.hp -= bullet.damage
    this.popBullet(bullet)
    this.drawEnemyHealth(enemy)
    if (enemy.hp > 0) {
      // Snappers get knocked back a little, away from the shot.
      const t = ENEMIES.snapper
      if (enemy.kind === 'snapper') { enemy.stunnedUntil = this.playTime + t.knockbackTime; enemy.setVelocityX(Math.sign(bullet.impactX - enemy.x) * -t.knockback || this.facing * t.knockback) }
      // A white flash. The spitter's warning uses its own pose, so this can't hide it.
      enemy.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
      this.time.delayedCall(90, () => { if (enemy.active) enemy.clearTint() })
      return
    }
    const { x, y } = enemy
    enemy.healthBar.destroy()
    enemy.alert.destroy()
    enemy.destroy()
    state.run.defeated++
    this.burst(x, y - 25, 12, 0xffffff)
    this.burst(x, y - 35, 7, enemy.kind === 'spitter' ? 0xb07cd8 : 0x4fc47e)
    sound('poof')
    // Drops appear in a row where the enemy stood, research just above.
    for (let i = 0; i < LOOT.coinsPerEnemy; i++) this.createLoot(x + (i - (LOOT.coinsPerEnemy - 1) / 2) * 32, y - 14, 'coins')
    for (let i = 0; i < LOOT.researchPerEnemy; i++) this.createLoot(x + (i - (LOOT.researchPerEnemy - 1) / 2) * 32, y - 48, 'research')
  }

  hurt(fromX) {
    if (state.mode !== 'playing' || this.playTime < this.hurtUntil || this.playTime < this.dashUntil) return
    state.health--
    emit('health', state.health)
    if (state.health <= 0) { this.die('Out of hearts'); return }
    this.hurtUntil = this.playTime + PLAYER.hurtProtection
    this.knockUntil = this.playTime + PLAYER.knockbackTime
    this.hero.setVelocity((this.hero.x < fromX ? -1 : 1) * PLAYER.knockbackX, -PLAYER.knockbackY)
    this.cameras.main.shake(120, 0.003)
    this.hurtFlash.setAlpha(0.35)
    this.tweens.add({ targets: this.hurtFlash, alpha: 0, duration: 250 })
    sound('hit')
  }

  die(reason) {
    if (state.mode !== 'playing') return
    this.physics.pause()
    this.hero.setVelocity(0, 0).setTexture('ozo-idle').setAlpha(1).setTint(0x10151f).setTintMode(Phaser.TintModes.FILL)
    this.glider.setVisible(false)
    loseRun() // loot from this run only counts if the level is finished
    setMode('dying')
    const view = this.cameras.main
    view.stopFollow()
    sound('death')
    // Lift Ozo up to the middle of the screen, then fade everything to black before the result card.
    const centerX = view.scrollX + view.width / 2, centerY = view.scrollY + view.height / 2
    this.tweens.add({ targets: this.hero, x: centerX, y: centerY, duration: 700, ease: 'Quad.easeOut' })
    this.time.delayedCall(700, () => {
      const x = this.hero.x, y = this.hero.y - 49, size = PX * 1.5
      const heart = this.add.image(x, y, 'heart').setDepth(45).setScale(0)
      this.tweens.add({ targets: heart, scale: size, duration: 280, ease: 'Back.easeOut' })
      this.time.delayedCall(580, () => {
        heart.destroy()
        for (let i = 0; i < 2; i++) {
          const half = this.add.image(x, y, `heart-${i}`).setDepth(45).setScale(size)
          this.tweens.add({ targets: half, x: x + (i ? 45 : -45), y: y + 55, angle: i ? 35 : -35, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => half.destroy() })
        }
        this.burst(x, y, 10, 0xff5a7a, 0.7)
      })
    })
    const fade = this.add.rectangle(view.width / 2, view.height / 2, view.width, view.height, 0x000000, 0).setScrollFactor(0).setDepth(100)
    this.tweens.add({ targets: fade, alpha: 1, duration: 400, delay: 1450, ease: 'Quad.easeIn' })
    this.time.delayedCall(1850, () => { emit('death-reason', reason); setMode('dead') })
  }

  win() {
    if (this.finished || state.mode !== 'playing') return
    this.finished = true
    this.physics.pause()
    this.glider.setVisible(false)
    state.run.seconds = Math.round(this.playTime / 1000)
    if (!state.profile.best || state.run.seconds < state.profile.best) state.profile.best = state.run.seconds
    bankRun() // adds this run's loot to the saved totals
    setMode('winning')
    this.enterHouse()
  }

  // Ozo hops up to the birdhouse, shrinks and slips in through the doorway.
  enterHouse() {
    const hero = this.hero, door = this.doorway, from = { x: hero.x, y: hero.y }, hop = { t: 0 }
    hero.setAlpha(1).setFlipX(door.x < hero.x).setTexture('ozo-jump', undefined, false, false)
    sound('jump')
    this.tweens.add({
      targets: hop, t: 1, duration: 600, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = hop.t
        hero.setPosition(Phaser.Math.Linear(from.x, door.x, t), Phaser.Math.Linear(from.y, door.y + 12, t) - Math.sin(Math.PI * t) * 70)
        hero.setScale(PX * (1 - 0.6 * t))
      },
      onComplete: () => {
        hero.setDepth(8.5) // between the dark inside and the front of the house
        this.tweens.add({
          targets: hero, y: door.y + 4, scale: PX * 0.15, alpha: 0, duration: 350, ease: 'Quad.easeIn',
          onComplete: () => {
            sound('win')
            this.tweens.add({ targets: this.house, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.house.setAngle(0) })
            this.burst(door.x, door.y, 12, 0xff5a7a, 0.8)
            for (let i = 0; i < 4; i++) this.time.delayedCall(150 + i * 140, () => this.burst(door.x + between(-90, 90), door.y - between(40, 140), 12, [0xffd23f, 0x7ef2df, 0xff7fb8][i % 3]))
            this.time.delayedCall(1200, () => setMode('complete'))
          },
        })
      },
    })
  }

  // Square pixel particles flying out from a point.
  burst(x, y, count, color = 0xffffff, spread = 1) {
    for (let i = 0; i < count; i++) {
      const size = PX * between(1, 2)
      const bit = this.add.image(x, y, 'px').setDisplaySize(size, size).setTint(color).setDepth(30)
      this.tweens.add({ targets: bit, x: x + between(-65, 65) * spread, y: y + between(-65, 30) * spread, alpha: 0, duration: between(280, 600), ease: 'Quad.easeOut', onComplete: () => bit.destroy() })
    }
  }

  floatText(x, y, text) {
    const label = this.add.text(x, y, text, { ...FONT, fontSize: '22px', color: '#fff4cf', stroke: '#10202c', strokeThickness: 4 }).setOrigin(0.5).setDepth(40)
    this.tweens.add({ targets: label, y: y - 55, alpha: 0, delay: 500, duration: 1100, onComplete: () => label.destroy() })
  }

  update(_, delta) {
    if (!this.hero || state.mode !== 'playing') return
    const L = this.level
    this.playTime += Math.min(delta, 50)
    const now = this.playTime, input = state.input, body = this.hero.body
    const grounded = body.blocked.down || body.touching.down
    if (grounded) this.lastGround = now
    if (input.jumpQueued) { this.jumpBuffer = now + PLAYER.jumpBuffer; input.jumpQueued = false }
    if (this.jumpBuffer >= now && now - this.lastGround < PLAYER.coyoteTime) {
      this.hero.setVelocityY(-(this.loadout.jump ? PLAYER.springStepJumpVelocity : PLAYER.jumpVelocity))
      this.rising = true
      this.jumpTime = 0
      this.jumpsMade++
      this.lastGround = -1000; this.jumpBuffer = -1000
      this.burst(this.hero.x, this.hero.y, 5, 0xeaffce, 0.7)
      sound('jump')
    }
    const direction = Number(input.right) - Number(input.left)
    if (direction) this.facing = direction
    this.cameraLead += (-this.facing * CAMERA.lookAhead - this.cameraLead) * (1 - Math.exp(-delta / CAMERA.turnTime))
    this.cameras.main.setFollowOffset(this.cameraLead, 0)
    if (input.dashQueued) {
      input.dashQueued = false
      if (this.loadout.dash && now >= this.dashReady) { this.dashUntil = now + PLAYER.dashTime; this.dashReady = now + PLAYER.dashCooldown; sound('dash') }
    }
    const dashing = now < this.dashUntil
    if (dashing) {
      body.setVelocity(this.facing * PLAYER.dashSpeed, 0)
      if (Math.floor(now / 40) !== this.lastDashTrail) { this.lastDashTrail = Math.floor(now / 40); this.burst(this.hero.x - this.facing * 20, this.hero.y - 25, 2, 0x8ff7d2) }
    } else if (!(now < this.knockUntil)) body.setVelocityX(direction * (this.loadout.speed ? PLAYER.happyFeetRunSpeed : PLAYER.runSpeed))
    const gliding = this.loadout.glide && input.jump && !grounded && body.velocity.y > 0 && !dashing
    if (gliding) body.setVelocityY(Math.min(body.velocity.y, PLAYER.glideFallSpeed))
    this.glider.setVisible(gliding).setPosition(this.hero.x, this.hero.y - 80)
    this.hero.setFlipX(this.facing < 0)
    const moving = grounded && Math.abs(body.velocity.x) > 1 && !body.blocked.left && !body.blocked.right
    if (moving) this.runStride += Math.abs(body.velocity.x) * Math.min(delta, 50) / 1000
    const pose = !grounded ? 'ozo-jump' : moving ? `ozo-run-${Math.floor(this.runStride / 16) % 4}` : 'ozo-idle'
    if (this.hero.texture.key !== pose) this.hero.setTexture(pose, undefined, false, false)
    this.hero.setAlpha(now < this.hurtUntil ? (Math.floor(now / 90) % 2 ? 0.35 : 1) : 1)
    if ((input.shoot || input.shootQueued) && now >= this.shotAt) {
      input.shootQueued = false
      this.shotAt = now + (this.loadout.equipped === 'twin' ? BLASTER.twinCooldown : BLASTER.cooldown)
      this.shoot()
    }
    if (this.hero.y > L.floor + 102) { this.hero.setY(L.floor + 82); this.die('Missed the landing'); return }

    for (const enemy of this.enemies.getChildren()) {
      enemy.healthBar.setPosition(enemy.x - 24, enemy.y - 80)
      enemy.alert.setPosition(enemy.x, enemy.y - 104)
      const dx = this.hero.x - enemy.x
      if (enemy.kind === 'snapper') this.updateSnapper(enemy, dx)
      else this.updateSpitter(enemy, dx, now)
    }
    for (const group of [this.shots, this.enemyShots]) for (const bullet of [...group.getChildren()]) {
      if (now > bullet.expires || bullet.x < 0 || bullet.x > L.width || bullet.y > 750 || bullet.y < 0) bullet.destroy()
    }
    for (const loot of [...this.loot.getChildren()]) {
      if (loot.kind === 'heart') continue
      const dx = this.hero.x - loot.x, dy = this.hero.y - 35 - loot.y
      const distance = Math.hypot(dx, dy)
      if (distance < LOOT.magnetRadius || loot.magnet) {
        loot.magnet = true
        if (distance < 24) this.takeLoot(loot)
        else loot.setVelocity(dx / distance * LOOT.magnetSpeed, dy / distance * LOOT.magnetSpeed)
      }
    }
    if (Math.floor(now / 200) !== this.lastHudTick) {
      this.lastHudTick = Math.floor(now / 200)
      emit('progress', clamp((this.hero.x - L.start) / (L.exit - L.start), 0, 1))
      if (!this.wallBroken) emit('objective', this.hero.x > L.wall.hintFrom ? 'Keep shooting to break the wall' : 'Find the crumbling wall')
    }
    if (!this.checkpointReached && L.checkpoint && this.hero.x >= L.checkpoint) this.reachCheckpoint()
    if (this.hero.x > L.exit - 45 && this.hero.y > L.floor - 110 && this.wallBroken) this.win()
  }

  updateSnapper(enemy, dx) {
    const t = ENEMIES.snapper, near = Math.abs(dx) < t.noticeRange
    if (this.playTime < enemy.stunnedUntil) {
      // Being knocked back, but never far out of its patrol area (so never into a pit).
      if (enemy.x < enemy.patrolMin - 30 || enemy.x > enemy.patrolMax + 30) enemy.setVelocityX(0)
      return
    }
    if (near) enemy.direction = Math.sign(dx) || enemy.direction
    // At a patrol edge: turn back, or wait there facing Ozo if he is beyond it.
    let move = enemy.direction
    if (enemy.x <= enemy.patrolMin && move < 0) { if (near) move = 0; else enemy.direction = move = 1 }
    if (enemy.x >= enemy.patrolMax && move > 0) { if (near) move = 0; else enemy.direction = move = -1 }
    enemy.setVelocityX(move * (Math.abs(dx) < t.chaseRange ? t.chaseSpeed : t.patrolSpeed))
    enemy.setFlipX(enemy.direction < 0)
  }

  updateSpitter(enemy, dx, now) {
    const t = ENEMIES.spitter
    enemy.setFlipX(dx < 0)
    const setWarning = on => {
      enemy.warning = on
      enemy.setTexture(on ? 'spitter-charge' : 'spitter')
      enemy.alert.setVisible(on)
    }
    if (Math.abs(dx) >= t.fireRange) {
      if (enemy.warning) { setWarning(false); enemy.fireAt = now + 400 }
      return
    }
    if (!enemy.warning && now >= enemy.fireAt) { setWarning(true); enemy.warningUntil = now + t.windUp }
    if (enemy.warning && now >= enemy.warningUntil) {
      setWarning(false)
      enemy.fireAt = now + t.reload
      const x = enemy.x + Math.sign(dx) * 24, y = enemy.y - 33
      const aimX = this.hero.x - x, aimY = this.hero.y - 37 - y, distance = Math.hypot(aimX, aimY) || 1
      this.spawnShot(true, x, y, aimX / distance * t.shotSpeed, aimY / distance * t.shotSpeed)
    }
  }
}
