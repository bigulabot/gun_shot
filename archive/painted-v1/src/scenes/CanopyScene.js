import Phaser from 'phaser'
import { createArt, terrainTexture } from '../game/art.js'
import { state, emit, setMode, collect, saveProfile } from '../game/state.js'
import { sound } from '../game/audio.js'
import { bodySweep, sweep, rangeEnd, canLandOnPlatform, shotRange, enemyHealth, ENEMY_SHOT_RANGE, WALL_HEALTH } from '../game/combat.js'

const WORLD_WIDTH = 4320
const FLOOR = 575
const clamp = Phaser.Math.Clamp

export class CanopyScene extends Phaser.Scene {
  constructor() { super('CanopyScene') }

  create(data = {}) {
    createArt(this)
    this.playTime = 0
    this.facing = 1
    this.lastGround = -1000
    this.jumpBuffer = -1000
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
    state.health = 3
    state.run = { coins: 0, research: 0, defeated: 0, seconds: 0 }
    this.physics.world.setBounds(0, -200, WORLD_WIDTH, 1150)
    this.physics.world.setBoundsCollision(true, true, false, false)
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 720)
    this.drawBackground()

    this.platforms = this.physics.add.staticGroup()
    for (const [x, width] of [[0, 960], [1080, 860], [2050, 900], [3080, 1240]]) this.addPlatform(x, FLOOR, width, 210)
    for (const [x, y, width] of [[410, 466, 155], [655, 400, 160], [1260, 466, 145], [1730, 466, 130], [2690, 466, 170], [3360, 466, 160], [3590, 400, 160]]) this.addPlatform(x, y, width, 25, true)
    this.addPlatform(2030, 500, 220, 63, true)
    this.decorateWorld()
    this.createWall()
    this.createExit()

    this.hero = this.physics.add.sprite(170, FLOOR - 2, 'ozo-0').setOrigin(0.5, 120 / 128).setScale(0.39).setDepth(20)
    this.hero.body.setSize(92, 168).setOffset(68, 72)
    this.hero.setCollideWorldBounds(true)
    this.hero.body.setMaxVelocity(650, 1000)
    this.shadow = this.add.ellipse(170, FLOOR + 3, 50, 10, 0x244f60, 0.2).setDepth(11)
    this.glideWing = this.add.graphics().setDepth(19).setVisible(false)
    this.glideWing.fillStyle(0xffdc83, 1)
    this.glideWing.fillTriangle(-65, 10, 0, -25, 65, 10)
    this.glideWing.fillStyle(0xf5a976, 1)
    this.glideWing.fillTriangle(0, -25, 0, 10, 65, 10)
    this.glideWing.lineStyle(3, 0xfff0c2, 1).strokeTriangle(-65, 10, 0, -25, 65, 10)

    this.enemies = this.physics.add.group()
    for (const [x, type, min, max] of [
      [740, 'snapper', 595, 880], [1515, 'spitter', 1430, 1580],
      [1810, 'snapper', 1650, 1890], [2800, 'spitter', 2590, 2890],
      [3300, 'snapper', 3150, 3330], [3730, 'spitter', 3650, 3840],
    ]) this.createEnemy(x, type, min, max)
    this.shots = this.physics.add.group({ allowGravity: false, maxSize: 50 })
    this.enemyShots = this.physics.add.group({ allowGravity: false, maxSize: 24 })
    this.loot = this.physics.add.group({ bounceY: 0.25 })
    for (const [x, y, kind] of [[435, 430, 'coins'], [487, 430, 'coins'], [717, 364, 'research'], [1310, 430, 'coins'], [1370, 430, 'coins'], [2730, 430, 'coins'], [2790, 430, 'coins'], [3635, 364, 'research']]) this.createLoot(x, y, kind, false)

    this.physics.add.collider(this.hero, this.platforms, undefined, (hero, platform) => canLandOnPlatform(hero.body, platform))
    this.physics.add.collider(this.hero, this.wallCollider)
    this.physics.add.collider(this.enemies, this.platforms)
    this.physics.add.collider(this.loot, this.platforms)
    this.physics.add.overlap(this.hero, this.enemies, (_, enemy) => this.hurt(enemy.x))
    this.physics.add.overlap(this.hero, this.loot, (_, loot) => this.takeLoot(loot))
    // Resolve projectile events in travel order after each physics step. There
    // are no group-vs-single callbacks that can mistake a wall for a bullet.
    const world = this.physics.world
    world.on('worldstep', this.resolveProjectiles, this)
    this.events.once('shutdown', () => world.off('worldstep', this.resolveProjectiles, this))
    this.cameras.main.startFollow(this.hero, false, 1, 0)
    this.cameras.main.setFollowOffset(-200, 0)
    this.physics.pause()
    setMode(data.autostart ? 'playing' : 'title')
    if (data.autostart) this.physics.resume()
    emit('ready', this.textures.get('ozo-portrait').getSourceImage().toDataURL())
    emit('health', 3)
    emit('progress', 0)
    emit('objective', 'Find the crumbling wall')
  }

  startRun() { this.scene.restart({ autostart: true }) }
  pauseRun() {
    if (state.mode !== 'playing') return
    this.physics.pause(); setMode('paused')
  }
  resumeRun() {
    if (state.mode !== 'paused') return
    setMode('playing'); this.physics.resume()
  }
  goHome() { this.scene.restart({ autostart: false }) }

  drawBackground() {
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-20)
    this.far = this.add.tileSprite(0, 0, 1280, 720, 'jungle-0').setOrigin(0).setScrollFactor(0).setDepth(-19)
    this.near = this.add.tileSprite(0, 0, 1280, 720, 'jungle-1').setOrigin(0).setScrollFactor(0).setDepth(-18)
    // Small drifting motes carry depth without obscuring gameplay.
    for (let i = 0; i < 20; i++) {
      const mote = this.add.circle((i * 173) % 1280, 180 + (i * 73) % 300, i % 3 ? 2 : 3, 0xffffd3, 0.5).setScrollFactor(0.15).setDepth(-10)
      this.tweens.add({ targets: mote, y: mote.y - 30, alpha: 0.15, duration: 2300 + i * 151, yoyo: true, repeat: -1 })
    }
  }

  addPlatform(x, y, width, height, floating = false) {
    this.add.image(x - 4, y - 10, terrainTexture(this, width, height, floating)).setOrigin(0).setDepth(10)
    const collider = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0, 0)
    this.physics.add.existing(collider, true)
    this.platforms.add(collider)
    collider.oneWay = floating
  }

  decorateWorld() {
    for (const [x, scale] of [[50, 1.22], [355, 0.95], [1170, 1.35], [1610, 0.85], [2580, 1.32], [3180, 1], [3890, 1.2], [4260, 1.7]]) {
      this.add.image(x, FLOOR + 8, 'palm').setOrigin(0.5, 1).setScale(scale).setDepth(-4)
    }
    for (const x of [20, 300, 845, 1150, 1630, 1850, 2390, 2870, 3160, 3510, 3870, 4290]) this.add.image(x, FLOOR + 9, 'bush').setOrigin(0.5, 1).setScale(0.6 + (x % 4) * 0.1).setDepth(8)
    for (const x of [70, 348, 1180, 1660, 2580, 3115, 3930]) this.add.image(x, FLOOR, 'flower').setOrigin(0.5, 1).setScale(0.65).setDepth(9)
    this.sign(270, FLOOR, 'THIS WAY', '→')
    this.sign(878, FLOOR, 'MIND THE GAP', '↟')
    this.sign(2040, FLOOR, 'BREAK THE WALL', '✦')
    this.sign(3940, FLOOR, 'ALMOST HOME', '→')
    this.add.text(180, 345, 'A LITTLE BIRD.\nA BIG ADVENTURE.', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#326e6d', lineSpacing: 4 }).setAlpha(0.65).setDepth(-2)
    this.add.text(2070, 362, 'Keep popping!\nWatch it crumble.', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#fff8dc', align: 'center', stroke: '#397e78', strokeThickness: 4 }).setDepth(16)
    this.add.image(28, 735, 'bush').setOrigin(0.5, 1).setScale(1.9).setScrollFactor(0).setDepth(12).setAlpha(0.7)
    this.add.image(1280, 740, 'bush').setOrigin(0.5, 1).setScale(2).setFlipX(true).setScrollFactor(0).setDepth(12).setAlpha(0.7)
  }

  sign(x, y, label, arrow) {
    const g = this.add.graphics().setDepth(15)
    g.fillStyle(0x8e765b).fillRoundedRect(x - 5, y - 72, 10, 72, 3)
    g.fillStyle(0xf6ddb0).fillRoundedRect(x - 65, y - 85, 130, 37, 8)
    g.lineStyle(2, 0xc99d68).strokeRoundedRect(x - 65, y - 85, 130, 37, 8)
    this.add.text(x, y - 66, `${label}  ${arrow}`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#547d68' }).setOrigin(0.5).setDepth(16)
  }

  createWall() {
    this.wallHp = WALL_HEALTH
    this.wallBlocks = []
    for (let row = 0; row < 6; row++) for (let col = 0; col < 2; col++) {
      const block = this.add.graphics({ x: 2430 + col * 50, y: FLOOR - 264 + row * 44 }).setDepth(14)
      block.fillStyle((row + col) % 2 ? 0xd9ad7e : 0xedc899).fillRoundedRect(1, 1, 48, 43, 6)
      block.lineStyle(3, 0x977656).strokeRoundedRect(1, 1, 48, 43, 6)
      block.lineStyle(3, 0xffe8b2).lineBetween(8, 7, 40, 7)
      this.wallBlocks.push(block)
    }
    this.wallCracks = this.add.graphics().setDepth(15)
    this.wallCollider = this.add.rectangle(2480, FLOOR - 132, 100, 264, 0, 0)
    this.physics.add.existing(this.wallCollider, true)
    this.wallLabel = this.add.text(2480, FLOOR - 294, 'KEEP SHOOTING  12 / 12', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#fff7dc', backgroundColor: '#387b72', padding: { x: 10, y: 6 } }).setOrigin(0.5).setDepth(16)
  }

  hitWall(bullet) {
    if (this.wallBroken || !bullet.active) return
    this.wallHp = Math.max(0, this.wallHp - bullet.damage)
    this.popBullet(bullet)
    this.wallLabel.setText(`KEEP SHOOTING  ${this.wallHp} / ${WALL_HEALTH}`)
    const removedRows = this.wallHp === 0 ? 6 : Math.floor((WALL_HEALTH - this.wallHp) / 4)
    this.wallBlocks.forEach((block, i) => {
      if (block.falling || Math.floor(i / 2) >= removedRows) return
      block.falling = true
      this.tweens.add({ targets: block, x: block.x + (i % 2 ? 60 : -60), y: block.y + 120, angle: i % 2 ? 35 : -35, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => block.destroy() })
    })
    const height = (6 - removedRows) * 44
    this.wallCracks.clear().lineStyle(3, 0x856349)
    if (height) {
      // Collider shrinks with the missing stones, but remains solid until broken.
      this.wallCollider.setSize(100, height).setPosition(2480, FLOOR - height / 2)
      this.wallCollider.body.setSize(100, height).updateFromGameObject()
      for (let i = 0; i < WALL_HEALTH - this.wallHp; i++) {
        const x = 2440 + (i * 31) % 74, y = FLOOR - 15 - (i * 37) % (height - 20)
        this.wallCracks.beginPath().moveTo(x, y).lineTo(x + 8, y - 12).lineTo(x + 2, y - 22).strokePath()
      }
      this.burst(2430, Math.min(FLOOR - 15, bullet.impactY ?? FLOOR - 40), 5, 'dust', 0xedc899, 0.6)
      return
    }
    this.wallBroken = true
    this.wallCollider.body.enable = false
    this.wallLabel.setText('PATH CLEAR!')
    this.burst(2480, FLOOR - 65, 24, 'dust', 0xedc899, 1.4)
    this.floatText(2480, FLOOR - 150, 'WALL DOWN!', '#ffffcd')
    sound('switch')
    emit('objective', 'Path clear. Head home!')
    emit('toast', 'Wall down! Keep heading right.')
  }

  createExit() {
    const x = 4130
    const g = this.add.graphics().setDepth(9)
    g.fillStyle(0x3c8d83, 0.22).fillEllipse(x, FLOOR, 155, 25)
    g.fillStyle(0x578e78).fillRoundedRect(x - 76, FLOOR - 191, 152, 195, 70)
    g.fillStyle(0xffe6a2).fillRoundedRect(x - 66, FLOOR - 186, 132, 190, 65)
    g.fillStyle(0x519e91).fillRoundedRect(x - 48, FLOOR - 171, 96, 180, 45)
    g.fillStyle(0xa8eed1, 0.7).fillRoundedRect(x - 34, FLOOR - 156, 68, 161, 33)
    this.add.text(x, FLOOR - 225, 'HOME SWEET HOME', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff8d9', stroke: '#457c6b', strokeThickness: 4 }).setOrigin(0.5).setDepth(11)
    const star = this.add.image(x, FLOOR - 95, 'spark').setScale(2.3).setDepth(11)
    this.tweens.add({ targets: star, angle: 180, scale: 1.7, duration: 2400, yoyo: true, repeat: -1 })
    for (const dx of [-72, 72]) this.add.image(x + dx, FLOOR, 'flower').setOrigin(0.5, 1).setScale(0.9).setDepth(12)
  }

  createEnemy(x, type, min, max) {
    const enemy = this.physics.add.sprite(x, FLOOR, type).setOrigin(0.5, 88 / 96).setScale(0.87).setDepth(18)
    this.enemies.add(enemy)
    enemy.body.setSize(61, 72).setOffset(16, 16)
    Object.assign(enemy, { kind: type, hp: enemyHealth(type), maxHp: enemyHealth(type), patrolMin: min, patrolMax: max, direction: -1, fireAt: 1300 + x % 700, warning: false })
    enemy.healthBar = this.add.graphics().setDepth(25)
    this.drawEnemyHealth(enemy)
    return enemy
  }

  createLoot(x, y, currency, tossed = true) {
    const loot = this.loot.create(x, y, currency === 'coins' ? 'coin' : 'research').setDepth(24).setScale(currency === 'coins' ? 0.72 : 0.65)
    loot.currency = currency
    loot.body.setSize(25, 28, true)
    loot.setVelocity(tossed ? Phaser.Math.Between(-100, 100) : 0, tossed ? -240 : 0)
    if (!tossed) loot.body.setAllowGravity(false)
    loot.magnet = false
  }

  takeLoot(loot) {
    if (!loot.active || state.mode !== 'playing') return
    collect(loot.currency)
    sound(loot.currency === 'coins' ? 'coin' : 'research')
    this.burst(loot.x, loot.y, 4, 'spark', loot.currency === 'coins' ? 0xffe394 : 0x9cffe2)
    loot.destroy()
  }

  shoot() {
    const fire = () => {
      if (state.mode !== 'playing') return
      const bullet = this.shots.create(this.hero.x + this.facing * 40, this.hero.y - 40, 'pop')
      if (!bullet) return
      this.shotsFired++
      bullet.setDepth(22).setFlipX(this.facing < 0)
      bullet.body.setSize(22, 12).setAllowGravity(false)
      bullet.setVelocityX(this.facing * 780)
      bullet.expires = this.playTime + 1000
      bullet.damage = this.loadout.power ? 2 : 1
      bullet.range = shotRange(this.loadout.range)
      bullet.travelled = 0
      sound('shoot')
      this.burst(bullet.x, bullet.y, 2, 'spark', 0xdffff0, 0.4)
    }
    fire()
    if (this.loadout.equipped === 'twin') this.time.delayedCall(80, fire)
  }

  popBullet(bullet) {
    if (!bullet.active) return
    this.burst(bullet.impactX ?? bullet.body.center.x, bullet.impactY ?? bullet.body.center.y, 3, 'spark', 0xfff3ce, 0.35)
    bullet.destroy()
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
    for (const bullet of shots) {
      for (const other of incoming) addHit(bullet, other, 'intercept', 0)
      for (const enemy of this.enemies.getChildren()) if (enemy.active) addHit(bullet, enemy, 'enemy')
    }
    for (const bullet of incoming) addHit(bullet, this.hero, 'hero')
    // A nearer wall/target wins; ties favour interception over damage to Ozo.
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
      else {
        if (kind === 'intercept') { b.impactX = a.impactX; b.impactY = a.impactY; this.popBullet(b) }
        this.popBullet(a)
      }
    }
  }

  drawEnemyHealth(enemy) {
    const g = enemy.healthBar
    g.clear().setPosition(enemy.x - 24, enemy.y - 84)
    g.fillStyle(0x254f5b, 0.9).fillRoundedRect(-3, -3, 54, 11, 5)
    for (let i = 0; i < enemy.maxHp; i++) g.fillStyle(i < enemy.hp ? 0xffd47e : 0x64817e).fillRoundedRect(i * (48 / enemy.maxHp), 0, 48 / enemy.maxHp - 2, 5, 2)
  }

  hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || state.mode !== 'playing') return
    enemy.hp -= bullet.damage
    this.popBullet(bullet)
    this.drawEnemyHealth(enemy)
    if (enemy.hp > 0) {
      enemy.setTint(0xffecc2).setTintMode(Phaser.TintModes.FILL)
      this.time.delayedCall(90, () => { if (enemy.active) enemy.clearTint() })
      return
    }
    const { x, y } = enemy
    enemy.healthBar.destroy()
    enemy.destroy()
    state.run.defeated++
    this.burst(x, y - 25, 12, 'dust', 0xffedc5)
    this.burst(x, y - 35, 7, 'spark', 0xffd47e)
    sound('poof')
    for (let i = 0; i < 3; i++) this.createLoot(x + (i - 1) * 17, y - 35, 'coins')
    this.createLoot(x, y - 65, 'research')
  }

  hurt(fromX) {
    if (state.mode !== 'playing' || this.playTime < this.hurtUntil || this.playTime < this.dashUntil) return
    state.health--
    emit('health', state.health)
    if (state.health <= 0) { this.die('Out of hearts'); return }
    this.hurtUntil = this.playTime + 1500
    this.knockUntil = this.playTime + 180
    this.hero.setVelocity((this.hero.x < fromX ? -1 : 1) * 180, -190)
    this.cameras.main.shake(120, 0.003)
    sound('hit')
  }

  die(reason) {
    if (state.mode !== 'playing') return
    this.physics.pause()
    this.hero.setVelocity(0, 0).setTexture('ozo-0').setAlpha(1).setTint(0x10151f).setTintMode(Phaser.TintModes.FILL)
    this.glideWing.setVisible(false)
    setMode('dying')
    this.cameras.main.stopFollow()
    sound('death')
    const x = this.hero.x, y = this.hero.y - 49
    const heart = this.add.image(x, y, 'heart').setDepth(45).setScale(0)
    this.tweens.add({ targets: heart, scale: 0.9, duration: 280, ease: 'Back.easeOut' })
    this.time.delayedCall(580, () => {
      heart.destroy()
      for (let i = 0; i < 2; i++) {
        const half = this.add.image(x, y, `heart-${i}`).setDepth(45).setScale(0.9)
        this.tweens.add({ targets: half, x: x + (i ? 45 : -45), y: y + 55, angle: i ? 35 : -35, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => half.destroy() })
      }
      this.burst(x, y, 10, 'spark', 0xff7198, 0.7)
    })
    this.time.delayedCall(1450, () => { emit('death-reason', reason); setMode('dead') })
  }

  win() {
    if (this.finished || state.mode !== 'playing') return
    this.finished = true
    this.hero.setVelocity(0, 0).setTexture('ozo-0').setAlpha(1)
    this.physics.pause()
    state.run.seconds = Math.round(this.playTime / 1000)
    if (!state.profile.best || state.run.seconds < state.profile.best) { state.profile.best = state.run.seconds; saveProfile() }
    setMode('winning')
    sound('win')
    for (let i = 0; i < 5; i++) this.time.delayedCall(i * 140, () => this.burst(this.hero.x + Phaser.Math.Between(-100, 100), this.hero.y - Phaser.Math.Between(70, 190), 14, 'spark', [0xffd475, 0xa6fce0, 0xffa8be][i % 3]))
    this.time.delayedCall(1100, () => setMode('complete'))
  }

  burst(x, y, count, key = 'dust', tint = 0xffffff, scale = 1) {
    for (let i = 0; i < count; i++) {
      const particle = this.add.image(x, y, key).setDepth(30).setTint(tint).setScale(Phaser.Math.FloatBetween(0.25, 0.65) * scale)
      this.tweens.add({ targets: particle, x: x + Phaser.Math.Between(-65, 65) * scale, y: y + Phaser.Math.Between(-65, 30) * scale, angle: Phaser.Math.Between(-90, 90), scale: 0, alpha: 0, duration: Phaser.Math.Between(280, 600), ease: 'Quad.easeOut', onComplete: () => particle.destroy() })
    }
  }

  floatText(x, y, text, color) {
    const label = this.add.text(x, y, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color, stroke: '#377b78', strokeThickness: 4 }).setOrigin(0.5).setDepth(40)
    this.tweens.add({ targets: label, y: y - 55, alpha: 0, delay: 500, duration: 1100, onComplete: () => label.destroy() })
  }

  update(_, delta) {
    if (!this.hero) return
    this.far.tilePositionX = this.cameras.main.scrollX * 0.15
    this.near.tilePositionX = this.cameras.main.scrollX * 0.32
    if (state.mode !== 'playing') return
    this.playTime += Math.min(delta, 50)
    const now = this.playTime, input = state.input, body = this.hero.body
    const grounded = body.blocked.down || body.touching.down
    if (grounded) this.lastGround = now
    if (input.jumpQueued) { this.jumpBuffer = now + 140; input.jumpQueued = false }
    if (this.jumpBuffer >= now && now - this.lastGround < 105) {
      this.hero.setVelocityY(this.loadout.jump ? -670 : -625)
      this.jumpsMade++
      this.lastGround = -1000; this.jumpBuffer = -1000
      this.burst(this.hero.x, this.hero.y, 5, 'dust', 0xeaffce, 0.7)
      sound('jump')
    }
    const direction = Number(input.right) - Number(input.left)
    if (direction) this.facing = direction
    if (input.dashQueued) {
      input.dashQueued = false
      if (this.loadout.dash && now >= this.dashReady) { this.dashUntil = now + 160; this.dashReady = now + 950; sound('dash') }
    }
    const dashing = now < this.dashUntil
    if (dashing) {
      body.setVelocity(this.facing * 570, 0)
      if (Math.floor(now / 40) !== this.lastDashTrail) { this.lastDashTrail = Math.floor(now / 40); this.burst(this.hero.x - this.facing * 20, this.hero.y - 25, 2, 'dust', 0x9cfad8) }
    } else if (!(now < this.knockUntil)) body.setVelocityX(direction * (this.loadout.speed ? 299 : 260))
    const gliding = this.loadout.glide && input.jump && !grounded && body.velocity.y > 0 && !dashing
    if (gliding) body.setVelocityY(Math.min(body.velocity.y, 115))
    this.glideWing.setVisible(gliding).setPosition(this.hero.x, this.hero.y - 91)
    this.hero.setFlipX(this.facing < 0)
    const moving = grounded && Math.abs(body.velocity.x) > 1 && !body.blocked.left && !body.blocked.right
    if (moving) this.runStride += Math.abs(body.velocity.x) * Math.min(delta, 50) / 1000
    const pose = !grounded ? 'ozo-3' : moving ? `ozo-run-${Math.floor(this.runStride / 12) % 8}` : 'ozo-0'
    if (this.hero.texture.key !== pose) this.hero.setTexture(pose, undefined, false, false)
    this.hero.setAlpha(now < this.hurtUntil ? (Math.floor(now / 90) % 2 ? 0.35 : 1) : 1)
    this.shadow.setPosition(this.hero.x, grounded ? this.hero.y + 3 : FLOOR + 3).setVisible(grounded)
    if ((input.shoot || input.shootQueued) && now >= this.shotAt) {
      state.input.shootQueued = false
      this.shotAt = now + (this.loadout.equipped === 'twin' ? 320 : 235)
      this.shoot()
    }
    if (this.hero.y > 677) { this.hero.setY(657); this.die('Missed the landing'); return }

    for (const enemy of this.enemies.getChildren()) {
      this.drawEnemyHealth(enemy)
      const dx = this.hero.x - enemy.x
      if (enemy.kind === 'snapper') {
        if (Math.abs(dx) < 330) enemy.direction = Math.sign(dx) || 1
        if (enemy.x < enemy.patrolMin) enemy.direction = 1
        if (enemy.x > enemy.patrolMax) enemy.direction = -1
        enemy.setVelocityX(enemy.direction * (Math.abs(dx) < 290 ? 89 : 48))
      } else if (Math.abs(dx) < 520) {
        if (!enemy.warning && now >= enemy.fireAt) {
          enemy.warning = true
          enemy.warningUntil = now + 700
          enemy.setTint(0xffb5db)
        }
        if (enemy.warning && now >= enemy.warningUntil) {
          enemy.warning = false; enemy.clearTint(); enemy.fireAt = now + 2150
          const shot = this.enemyShots.create(enemy.x + Math.sign(dx) * 24, enemy.y - 33, 'enemy-pop')
          if (shot) {
            shot.setDepth(21); shot.body.setAllowGravity(false).setCircle(9, 3, 3)
            const dy = this.hero.y - 37 - shot.y
            const distance = Math.hypot(dx, dy) || 1
            shot.setVelocity(dx / distance * 185, dy / distance * 185)
            shot.expires = now + 3600
            shot.range = ENEMY_SHOT_RANGE
            shot.travelled = 0
          }
        }
      } else if (enemy.warning) {
        enemy.warning = false
        enemy.clearTint()
        enemy.fireAt = now + 400
      }
    }
    for (const group of [this.shots, this.enemyShots]) for (const bullet of [...group.getChildren()]) {
      if (now > bullet.expires || bullet.x < 0 || bullet.x > WORLD_WIDTH || bullet.y > 750 || bullet.y < 0) bullet.destroy()
    }
    for (const loot of [...this.loot.getChildren()]) {
      const dx = this.hero.x - loot.x, dy = this.hero.y - 35 - loot.y
      const distance = Math.hypot(dx, dy)
      if (distance < 145 || loot.magnet) {
        loot.magnet = true; loot.body.setAllowGravity(false)
        if (distance < 24) this.takeLoot(loot)
        else loot.setVelocity(dx / distance * 400, dy / distance * 400)
      } else if (loot.y > 730) loot.destroy()
    }
    if (Math.floor(now / 200) !== this.lastHudTick) {
      this.lastHudTick = Math.floor(now / 200)
      emit('progress', clamp((this.hero.x - 170) / (4130 - 170), 0, 1))
      if (!this.wallBroken) emit('objective', this.hero.x > 1900 ? 'Keep shooting to break the wall' : 'Find the crumbling wall')
    }
    if (this.hero.x > 4085 && this.hero.y > 465 && this.wallBroken) this.win()
  }
}
