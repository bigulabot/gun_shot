import Phaser from 'phaser'
import { state, cleanProfile, emit, resetInput, purchase } from './state.js'
import { shotRange, ENEMY_SHOT_RANGE, WALL_HEALTH } from './combat.js'

// Uses the real scene, physics and input state. No teleports or invincibility on
// the baseline route. Run manually at /?verify=1; never touches the saved profile.
export function setupVerification(game) {
  state.persistenceEnabled = false
  state.profile = cleanProfile()
  emit('profile')
  const panel = document.createElement('aside')
  panel.id = 'verification'
  panel.style.cssText = 'position:fixed;bottom:3px;left:3px;z-index:100;background:#142c35;color:#fff8db;border:1px solid #8dbaac;padding:8px;border-radius:6px;font:11px monospace;max-width:95vw;'
  panel.innerHTML = '<button id="verify-route">Check baseline route</button> <button id="verify-death">Check death + restart</button> <button id="verify-talents">Check talents + shop</button> <button id="verify-combat">Check combat fixes</button> <button id="verify-platforms">Check platforms + movement</button><output id="verify-result" style="display:block;padding-top:4px">Ready. Test progress is not saved.</output>'
  document.body.append(panel)
  const output = panel.querySelector('output')
  const scene = () => game.scene.getScene('CanopyScene')
  const telemetry = document.createElement('div')
  telemetry.id = 'verify-telemetry'
  panel.append(telemetry)
  function report() {
    const s = scene()
    if (s?.hero?.body) telemetry.textContent = `Ozo x=${Math.round(s.hero.x)} y=${Math.round(s.hero.y)} | jumps=${s.jumpsMade} shots=${s.shotsFired} | ${state.mode}`
    requestAnimationFrame(report)
  }
  requestAnimationFrame(report)
  let running = false
  async function until(check, timeout = 4000, tick = () => {}) {
    const start = performance.now()
    while (!check()) {
      if (performance.now() - start > timeout) throw new Error(`Timed out: ${state.mode}, x=${Math.round(scene().hero?.x || 0)}, y=${Math.round(scene().hero?.y || 0)}`)
      tick(); await new Promise(requestAnimationFrame)
    }
  }
  async function fresh() {
    const oldHero = scene().hero
    state.profile = cleanProfile(); emit('profile'); scene().startRun()
    await until(() => state.mode === 'playing' && scene().hero !== oldHero)
    await until(() => scene().hero.body.blocked.down)
  }
  async function check(name, fn) {
    if (running) return
    running = true; output.textContent = `RUNNING: ${name}`
    try { await fn(); output.textContent = `PASS: ${name}` }
    catch (error) { output.textContent = `FAIL: ${name}. ${error.message}` }
    finally { running = false; resetInput() }
  }
  panel.querySelector('#verify-route').onclick = () => check('baseline route, six enemies, loot, breakable wall, victory', async () => {
    await fresh()
    let nextJump = 0
    const jumps = [915, 1900, 2910]
    await until(() => state.mode === 'complete', 60000, () => {
      const s = scene(), x = s.hero.x, body = s.hero.body
      if (state.mode === 'dead' || state.mode === 'dying') throw new Error(`Died at x=${Math.round(x)}, health=${state.health}, next jump=${jumps[nextJump]}`)
      if (state.mode !== 'playing') return
      const target = s.enemies.getChildren().some(e => e.active && e.x > x && e.x - x < 275)
      state.input.right = !target && !(x > 2230 && x < 2470 && !s.wallBroken)
      state.input.shoot = true
      if (nextJump < jumps.length && x >= jumps[nextJump] && body.blocked.down) { state.input.jumpQueued = true; nextJump++ }
      output.textContent = `RUNNING: baseline x=${Math.round(x)}, y=${Math.round(s.hero.y)}, hearts=${state.health}, wall=${s.wallHp}, jumps=${nextJump}`
    })
    if (!scene().wallBroken || !state.run.coins || !state.run.research || state.run.defeated !== 6) throw new Error('Missing wall or enemy rewards')
    if (Object.values(state.profile.upgrades).some(Boolean)) throw new Error('Baseline used a talent')
  })
  panel.querySelector('#verify-death').onclick = () => check('damage protection, silhouette, heart, restart', async () => {
    await fresh()
    const s = scene()
    s.hurt(s.hero.x + 50)
    if (state.health !== 2) throw new Error('First hit did not remove one heart')
    s.hurt(s.hero.x + 50)
    if (state.health !== 2) throw new Error('Invulnerability did not prevent repeated contact damage')
    await until(() => s.playTime > s.hurtUntil)
    s.hurt(s.hero.x + 50)
    await until(() => s.playTime > s.hurtUntil)
    s.hurt(s.hero.x + 50)
    if (state.mode !== 'dying' || s.hero.body.velocity.length() !== 0 || s.hero.tintMode !== Phaser.TintModes.FILL) throw new Error('Death did not freeze and darken Ozo')
    await until(() => state.mode === 'dead')
    s.startRun(); await until(() => state.mode === 'playing' && state.health === 3)
    if (s.hero.x > 190 || s.wallBroken || s.wallHp !== WALL_HEALTH || s.enemies.countActive() !== 6) throw new Error('Level state did not restart')
    state.input.right = true
    await until(() => s.hero.body.velocity.x === 260, 600)
    s.pauseRun()
  })
  panel.querySelector('#verify-talents').onclick = () => check('purchase rules, jump, speed, dash, glide, twin blaster', async () => {
    await fresh()
    if (purchase('power')) throw new Error('Purchase accepted insufficient funds')
    state.profile.coins = 50; state.profile.research = 50
    for (const id of ['jump', 'speed', 'dash', 'glide', 'power', 'range', 'twin']) if (!purchase(id)) throw new Error(`Could not purchase ${id}`)
    if (purchase('power')) throw new Error('Duplicate purchase accepted')
    if (state.profile.coins !== 16 || state.profile.research !== 28) throw new Error('Currency debit is wrong')
    scene().startRun(); await until(() => scene().loadout.glide && state.mode === 'playing')
    await until(() => scene().hero.body.blocked.down)
    state.input.right = true
    await until(() => scene().hero.body.velocity.x === 299)
    state.input.right = false; state.input.jumpQueued = true; state.input.jump = true
    await until(() => scene().hero.body.velocity.y < -610)
    await until(() => scene().hero.body.velocity.y > 0)
    await until(() => scene().glideWing.visible)
    if (scene().hero.body.velocity.y > 120) throw new Error('Glide did not cap falling speed')
    state.input.dashQueued = true
    await until(() => scene().hero.body.velocity.x === 570)
    resetInput(); state.input.shoot = true
    await until(() => scene().shots.countActive() >= 2)
    if (scene().shots.getChildren().some(shot => shot.damage !== 2)) throw new Error('Power upgrade is not applied')
    if (scene().shots.getChildren().some(shot => shot.range !== 540)) throw new Error('Range upgrade is not applied')
    scene().pauseRun()
  })

  // Focused regression fixtures position actors deliberately; the full route
  // above is still played normally, without teleports, upgrades or invincibility.
  function quiet(s) { for (const e of s.enemies.getChildren()) e.body.enable = false }
  function projectile(s, incoming, x, y, vx, damage = 1) {
    const b = (incoming ? s.enemyShots : s.shots).create(x, y, incoming ? 'enemy-pop' : 'pop')
    b.body.setAllowGravity(false).setSize(incoming ? 18 : 22, incoming ? 18 : 12)
    b.setVelocityX(vx); b.damage = damage; b.travelled = 0
    b.range = incoming ? ENEMY_SHOT_RANGE : shotRange(s.loadout.range)
    b.expires = s.playTime + 5000
    return b
  }
  panel.querySelector('#verify-combat').onclick = () => check('interception, distance limits, enemy HP, multi-hit wall, burst safety', async () => {
    await fresh()
    const s = scene()
    quiet(s)
    for (const direction of [1, -1]) {
      const a = projectile(s, false, 400 - direction * 30, 230, direction * 5000)
      const b = projectile(s, true, 400 + direction * 30, 230, -direction * 3000)
      await until(() => !a.active || !b.active, 1000)
      if (a.active || b.active) throw new Error('Crossing projectiles did not destroy each other')
    }
    const a = projectile(s, false, 350, 230, 780)
    const b = projectile(s, true, 400, 280, -185)
    await until(() => a.travelled > 90)
    if (!a.active || !b.active) throw new Error('Vertically separated shots collided')
    a.destroy(); b.destroy()
    for (const upgraded of [false, true]) for (const direction of [1, -1]) {
      s.loadout.range = upgraded
      const shot = projectile(s, false, 1100, 230, direction * 780)
      await until(() => !shot.active)
      if (Math.abs(Math.abs(shot.impactX - 1100) - shotRange(upgraded)) > 1) throw new Error('Range is not measured from the muzzle in both directions')
    }
    s.loadout.range = false
    const enemy = s.enemies.getChildren()[0]
    enemy.body.enable = true; enemy.body.setAllowGravity(false); enemy.body.reset(650, 300)
    const first = projectile(s, false, 590, 260, 780)
    await until(() => !first.active)
    if (!enemy.active || enemy.hp !== 3 || !enemy.healthBar.active) throw new Error('Enemy did not retain three HP after one hit')
    for (let i = 0; i < 3; i++) {
      const shot = projectile(s, false, enemy.x - 60, enemy.y - 40, 780)
      await until(() => !shot.active)
    }
    if (enemy.active || state.run.defeated !== 1) throw new Error('Enemy did not die after four hits')
    s.hero.body.reset(2260, 575); s.hero.setVelocity(0, 0); s.facing = 1
    s.shoot(); await until(() => s.wallHp < WALL_HEALTH)
    if (s.wallHp !== WALL_HEALTH - 1 || s.wallBroken || !s.wallCollider.body.enable) throw new Error('One shot prematurely destroyed the wall')
    state.input.shoot = true
    await until(() => s.wallHp <= 8)
    resetInput()
    if (!s.wallBlocks.some(block => block.falling) || s.wallCollider.body.height !== 220) throw new Error('Wall did not partially collapse')
    s.loadout.power = true; s.loadout.equipped = 'twin'
    state.input.shoot = true
    await until(() => s.wallBroken)
    if (s.wallHp !== 0 || s.wallCollider.body.enable) throw new Error('Broken wall still blocks the path')
    const now = s.playTime
    await until(() => s.playTime > now + 1100) // Extra bursts must remain safe after destruction.
    resetInput(); state.input.right = true
    await until(() => s.hero.x > 2570)
    s.pauseRun()
  })
  panel.querySelector('#verify-platforms').onclick = () => check('jump through / land on ledges, solid ground, boosted movement stability', async () => {
    await fresh()
    const s = scene()
    quiet(s)
    s.hero.body.reset(485, 575); s.hero.setVelocity(0, 0)
    await until(() => s.hero.body.blocked.down)
    state.input.jumpQueued = true
    await until(() => s.hero.body.velocity.y < -400)
    await until(() => s.hero.body.blocked.down && s.hero.y < 480)
    if (Math.abs(s.hero.body.bottom - 466) > 2) throw new Error('Did not land on the first ledge from underneath')
    state.input.right = true
    await until(() => s.hero.x > 608)
    resetInput(); await until(() => s.hero.body.blocked.down)
    if (Math.abs(s.hero.body.bottom - 575) > 2) throw new Error('Ground lost its solid collision')
    s.hero.body.reset(170, 575); s.hero.setVelocity(0, 0); s.loadout.speed = true
    state.input.right = true
    const bodyWidth = s.hero.body.width, origin = s.hero.originY
    const poses = new Set(), start = s.playTime
    await until(() => s.playTime > start + 1400, 4000, () => {
      poses.add(s.hero.texture.key)
      if (s.hero.body.width !== bodyWidth || s.hero.originY !== origin) throw new Error('Animation changes Ozo’s collision size or origin')
      if (Math.abs(s.hero.body.bottom - 575) > 2) throw new Error('Ozo jitters vertically during boosted movement')
    })
    if (poses.size < 6 || s.hero.body.velocity.x !== 299) throw new Error('Boosted run does not use the smooth animation')
    resetInput(); s.pauseRun()
  })
}
