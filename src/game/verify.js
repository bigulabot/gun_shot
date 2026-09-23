import Phaser from 'phaser'
import { state, cleanProfile, emit, resetInput, purchase, collect } from './state.js'
import { shotRange, WALL_HEALTH } from './combat.js'
import { PLAYER, BLASTER, WALL, ENEMIES } from './tuning.js'
import { LEVELS } from '../levels/index.js'

// Uses the real scene, physics and input state. No teleports or invincibility on
// the baseline route. Run manually at /?verify=1; never touches the saved profile.
// Numbers come from tuning.js and the level file, so the checks follow your tweaks.
export function setupVerification(game) {
  state.persistenceEnabled = false
  state.profile = cleanProfile()
  emit('profile')
  const panel = document.createElement('aside')
  panel.id = 'verification'
  panel.style.cssText = 'position:fixed;bottom:3px;left:3px;z-index:100;background:#10202c;color:#fff4cf;border:1px solid #8dbaac;padding:8px;font:11px monospace;max-width:95vw;'
  panel.innerHTML = LEVELS.map(({ id }) => `<button id="verify-route-${id}">Check route ${id}</button> `).join('') + '<button id="verify-death">Check death + restart</button> <button id="verify-talents">Check talents + shop</button> <button id="verify-combat">Check combat fixes</button> <button id="verify-platforms">Check platforms + movement</button> <button id="verify-checkpoint">Check checkpoint</button><output id="verify-result" style="display:block;padding-top:4px">Ready. Test progress is not saved.</output>'
  document.body.append(panel)
  const output = panel.querySelector('output')
  const scene = () => game.scene.getScene('LevelScene')
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
  // ?verify=1&fast=1 drives the game by hand, frame after frame as fast as the
  // computer allows, instead of waiting for the browser to draw each one. The
  // checks then finish in seconds and work even in a hidden tab. Timeouts count
  // game time, so they mean the same in both modes.
  const fast = new URLSearchParams(location.search).has('fast')
  let clock = 0, framesSinceBreath = 0
  const now = () => fast ? clock : performance.now()
  // A message-channel hop lets the page handle clicks between batches of
  // frames; unlike a timer it isn't slowed down in a hidden tab.
  const breathe = () => new Promise(resolve => { const { port1, port2 } = new MessageChannel(); port1.onmessage = resolve; port2.postMessage(0) })
  function nextFrame() {
    if (!fast) return new Promise(requestAnimationFrame)
    game.loop.step(clock += 1000 / 60)
    if (++framesSinceBreath < 30) return Promise.resolve()
    framesSinceBreath = 0
    return breathe()
  }
  async function until(check, timeout = 4000, tick = () => {}) {
    const start = now()
    while (!check()) {
      if (now() - start > timeout) throw new Error(`Timed out: ${state.mode}, x=${Math.round(scene().hero?.x || 0)}, y=${Math.round(scene().hero?.y || 0)}`)
      tick(); await nextFrame()
    }
  }
  async function fresh(level = LEVELS[0]) {
    const oldHero = scene().hero
    state.profile = cleanProfile(); emit('profile'); scene().startLevel(level)
    await until(() => state.mode === 'playing' && scene().hero !== oldHero)
    await until(() => scene().hero.body.blocked.down)
  }
  async function check(name, fn) {
    if (running) return
    running = true; output.textContent = `RUNNING: ${name}`
    if (fast && game.loop.running) {
      game.loop.sleep(); clock = game.loop.lastTime
      // Phaser's tweens measure time with Date.now(), so make it follow the
      // game clock too, or animations would lag behind the fast frames.
      const realStart = Date.now(), clockStart = clock
      Date.now = () => realStart + (clock - clockStart)
    }
    try { await fn(); output.textContent = `PASS: ${name}` }
    catch (error) { output.textContent = `FAIL: ${name}. ${error.message}` }
    finally { running = false; resetInput() }
  }
  // Plays a whole level from the start like a careful player, with no
  // upgrades, teleports or invincibility: runs right, stops to shoot ground
  // enemies ahead, jumps the gaps, hops over enemy shots, waits for a wall to
  // fall, and crosses raft pits: waits at the edge, steps on, rides (jumping
  // up for a key and dropping back on if there is one), and steps off.
  async function playRoute(level) {
    await fresh(level)
    const s = scene(), L = s.level, wall = L.wall, floor = L.floor
    const gaps = L.ground.slice(0, -1).map(([x, width], i) => ({ start: x + width, end: L.ground[i + 1][0] }))
    const raftFor = gap => s.movers.getChildren().find(r => r.path.x - r.width / 2 <= gap.start + 25 && r.path.x + r.path.dx + r.width / 2 >= gap.end - 25)
    const raftGaps = gaps.filter(raftFor)
    // Take off a little before the end of each piece of ground, unless a raft crosses the gap.
    const jumps = gaps.filter(gap => !raftGaps.includes(gap)).map(gap => gap.start - 42)
    const keyLedge = L.key && L.ledges.find(([lx, , lw]) => L.key[0] >= lx && L.key[0] <= lx + lw)
    let nextJump = 0, raftStage = null
    await until(() => state.mode === 'complete', 120000, () => {
      const x = s.hero.x, body = s.hero.body, grounded = body.blocked.down || body.touching.down
      if (state.mode === 'dead' || state.mode === 'dying') throw new Error(`Died at x=${Math.round(x)}, health=${state.health}, next jump=${jumps[nextJump]}, raft stage=${raftStage}`)
      if (state.mode !== 'playing') return
      state.input.shoot = true
      state.input.jump = !grounded // hold jump for full-height jumps

      // Crossing a raft pit takes over until Ozo is safely on the far side.
      const gap = raftGaps.find(g => x > g.start - 140 && x < g.end + 30)
      if (gap) {
        const raft = raftFor(gap), left = raft.body.x, right = raft.body.right, movingRight = raft.body.velocity.x > 20
        const onRaft = grounded && body.touching.down && x > left - 10 && x < right + 10
        const onLedge = grounded && keyLedge && s.hero.y < floor - 50
        const needKey = keyLedge && !s.hasKey
        const go = right => { state.input.right = right; state.input.left = false }
        raftStage ??= 'waiting'
        if (raftStage === 'waiting') {
          // Walk to the edge, then wait for the raft to come right up to it.
          go(x < gap.start - 40)
          if (x >= gap.start - 40 && left <= gap.start + 10) raftStage = 'boarding'
        } else if (raftStage === 'boarding') {
          go(x < left + 50) // on, then stand still and let it carry him
          if (onRaft && x >= left + 50) raftStage = needKey ? 'toKey' : 'riding'
        } else if (raftStage === 'toKey') {
          go(false)
          const [lx, , lw] = keyLedge
          // Jump straight up while passing under the ledge: he lands on it.
          if (onRaft && x > lx + 20 && x < lx + lw / 2) { state.input.jumpQueued = state.input.jump = true; raftStage = 'up' }
        } else if (raftStage === 'up') {
          go(false)
          if (onLedge) raftStage = 'onLedge'
          else if (onRaft) raftStage = 'toKey' // missed: try again on the next pass
        } else if (raftStage === 'onLedge') {
          // Wait for the raft to come along under the ledge, heading right,
          // then walk off the ledge's right end and drop straight down: by the
          // time he lands, the raft has moved on to be under him.
          const [lx, , lw] = keyLedge, edge = lx + lw
          go(false)
          if (movingRight && left >= edge - 190 && left <= edge - 140) raftStage = 'dropping'
        } else if (raftStage === 'dropping') {
          const [lx, , lw] = keyLedge
          go(x < lx + lw + 22)
          if (onRaft) raftStage = 'riding'
        } else if (raftStage === 'riding') {
          // Ride to the far side, then step off.
          go(right >= gap.end - 20)
          if (grounded && !onRaft && x > gap.end + 5) raftStage = 'off'
        } else if (raftStage === 'off') go(true)
        output.textContent = `RUNNING: route ${L.id} x=${Math.round(x)}, raft=${raftStage}, key=${s.hasKey}, hearts=${state.health}`
        return
      }
      if (raftStage === 'off') raftStage = null // ready for the next raft pit

      // Enemies up on platforms are bonus ones (for the critter star): walk under them.
      const ahead = range => s.enemies.getChildren().some(e => e.active && !e.onPlatform && e.x > x && e.x - x < range)
      // Decide on the ground only: stopping mid-jump would drop Ozo into a pit.
      if (body.blocked.down) {
        const onLedge = s.hero.y < floor - 5 // shots from a ledge fly over enemies, so step back down
        const atGap = nextJump < jumps.length && x >= jumps[nextJump] - 5
        const waitForWall = wall && x > wall.x - 200 && x < wall.x + 40 && !s.wallBroken
        // Stop and shoot enemies ahead, including any within range of where the next jump lands.
        state.input.right = !ahead(275) && !(atGap && ahead(BLASTER.range)) && !waitForWall
        state.input.left = onLedge && ahead(275)
      }
      // Enemy shots can't be shot down, so hop straight up over any that are about to hit
      // (unless a ledge overhead would catch the hop).
      const incoming = s.enemyShots.getChildren().some(b => b.active && Math.sign(b.body.velocity.x) === Math.sign(x - b.x) && Math.abs(b.x - x) > 50 && Math.abs(b.x - x) < 95 && b.y > s.hero.y - 70)
      const ledgeAbove = L.ledges.some(([lx, ly, lw]) => x > lx - 20 && x < lx + lw + 20 && ly < s.hero.y - 60 && ly > s.hero.y - 140)
      if (incoming && body.blocked.down && !ledgeAbove) { state.input.right = state.input.left = false; state.input.jumpQueued = state.input.jump = true }
      // Only use a jump while actually running at the gap.
      if (state.input.right && nextJump < jumps.length && x >= jumps[nextJump] && body.blocked.down) { state.input.jumpQueued = state.input.jump = true; nextJump++ }
      output.textContent = `RUNNING: route ${L.id} x=${Math.round(x)}, y=${Math.round(s.hero.y)}, hearts=${state.health}, jumps=${nextJump}`
    })
    const groundEnemies = L.enemies.filter(([, , , , y]) => y === undefined).length
    if (wall && !s.wallBroken) throw new Error('Finished without breaking the wall')
    if (L.door && !s.doorOpen) throw new Error('Finished without opening the door')
    // Every ground enemy is beaten, or (a Mushy that fired its cap) gone.
    if (!state.run.coins || !state.run.research || state.run.defeated + s.escaped < groundEnemies) throw new Error(`Missing enemy rewards: beat ${state.run.defeated} (and ${s.escaped} got away) of ${groundEnemies} ground enemies`)
    lastRouteEscaped = s.escaped
    if (Object.values(state.profile.upgrades).some(Boolean)) throw new Error('Baseline used a talent')
    lastRouteTime = state.run.seconds
  }
  let lastRouteTime = 0, lastRouteEscaped = 0
  for (const level of LEVELS) {
    const goal = level.wall ? 'breakable wall' : 'raft, key and door'
    panel.querySelector(`#verify-route-${level.id}`).onclick = () => check(`route ${level.id}: no upgrades, enemies, loot, ${goal}, victory`, async () => {
      await playRoute(level)
      output.dataset.seconds = lastRouteTime // how long the careful player took, for setting star times
      output.dataset.escaped = lastRouteEscaped
    })
  }
  panel.querySelector('#verify-death').onclick = () => check('damage protection, silhouette, heart, restart', async () => {
    await fresh()
    const s = scene()
    s.hurt(s.hero.x + 50)
    if (state.health !== PLAYER.hearts - 1) throw new Error('First hit did not remove one heart')
    s.hurt(s.hero.x + 50)
    if (state.health !== PLAYER.hearts - 1) throw new Error('Invulnerability did not prevent repeated contact damage')
    while (state.health > 0) {
      await until(() => s.playTime > s.hurtUntil)
      s.hurt(s.hero.x + 50)
    }
    if (state.mode !== 'dying' || s.hero.body.velocity.length() !== 0 || s.hero.tintMode !== Phaser.TintModes.FILL) throw new Error('Death did not freeze and darken Ozo')
    await until(() => state.mode === 'dead')
    s.startRun(); await until(() => state.mode === 'playing' && state.health === PLAYER.hearts)
    if (s.hero.x > s.level.start + 20 || s.wallBroken || s.wallHp !== WALL_HEALTH || s.enemies.countActive() !== s.level.enemies.length) throw new Error('Level state did not restart')
    state.input.right = true
    await until(() => s.hero.body.velocity.x === PLAYER.runSpeed, 600)
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
    await until(() => scene().hero.body.velocity.x === PLAYER.happyFeetRunSpeed)
    state.input.right = false; state.input.jumpQueued = true; state.input.jump = true
    // Faster than a normal jump can ever be, so Spring step must be active.
    await until(() => scene().hero.body.velocity.y < -(PLAYER.jumpVelocity + 5))
    await until(() => scene().hero.body.velocity.y > 0)
    await until(() => scene().glider.visible)
    if (scene().hero.body.velocity.y > PLAYER.glideFallSpeed + 5) throw new Error('Glide did not cap falling speed')
    state.input.dashQueued = true
    await until(() => scene().hero.body.velocity.x === PLAYER.dashSpeed)
    resetInput(); state.input.shoot = true
    await until(() => scene().shots.countActive() >= 2)
    if (scene().shots.getChildren().some(shot => shot.damage !== BLASTER.popPowerDamage)) throw new Error('Power upgrade is not applied')
    if (scene().shots.getChildren().some(shot => shot.range !== BLASTER.longShotRange)) throw new Error('Range upgrade is not applied')
    scene().pauseRun()
  })

  // Focused regression fixtures position actors deliberately; the full route
  // above is still played normally, without teleports, upgrades or invincibility.
  function quiet(s) { for (const e of s.enemies.getChildren()) e.body.enable = false }
  function projectile(s, incoming, x, y, vx, damage = 1) {
    const b = s.spawnShot(incoming, x, y, vx)
    b.damage = damage
    b.expires = s.playTime + 5000
    return b
  }
  panel.querySelector('#verify-combat').onclick = () => check('shots pass each other, distance limits, enemy HP, multi-hit wall, burst safety', async () => {
    await fresh()
    const s = scene(), wall = s.level.wall, floor = s.level.floor
    quiet(s)
    for (const direction of [1, -1]) {
      const a = projectile(s, false, 400 - direction * 30, 230, direction * 780)
      const b = projectile(s, true, 400 + direction * 30, 230, -direction * 185)
      await until(() => !a.active || !b.active || (a.x - b.x) * direction > 40, 1000)
      if (!a.active || !b.active) throw new Error('Player and enemy shots should pass through each other')
      a.destroy(); b.destroy()
    }
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
    if (!enemy.active || enemy.hp !== enemy.maxHp - 1 || !enemy.healthBar.active) throw new Error('Enemy lost more than one HP from one hit')
    for (let i = 1; i < enemy.maxHp; i++) {
      const shot = projectile(s, false, enemy.x - 60, enemy.y - 40, 780)
      await until(() => !shot.active)
    }
    if (enemy.active || state.run.defeated !== 1) throw new Error('Enemy did not die after exactly its health in hits')
    s.hero.body.reset(wall.x - 170, floor); s.hero.setVelocity(0, 0); s.facing = 1
    s.shoot(); await until(() => s.wallHp < WALL_HEALTH)
    if (s.wallHp !== WALL_HEALTH - 1 || s.wallBroken || !s.wallCollider.body.enable) throw new Error('One shot prematurely destroyed the wall')
    state.input.shoot = true
    await until(() => s.wallHp <= WALL_HEALTH - WALL.healthPerRow)
    resetInput()
    if (!s.wallBlocks.some(block => block.falling) || s.wallCollider.body.height !== (wall.rows - 1) * 44) throw new Error('Wall did not partially collapse')
    s.loadout.power = true; s.loadout.equipped = 'twin'
    state.input.shoot = true
    await until(() => s.wallBroken)
    if (s.wallHp !== 0 || s.wallCollider.body.enable) throw new Error('Broken wall still blocks the path')
    const now = s.playTime
    await until(() => s.playTime > now + 1100) // Extra bursts must remain safe after destruction.
    resetInput(); state.input.right = true
    await until(() => s.hero.x > wall.x + wall.columns * 50 + 40)
    s.pauseRun()
  })
  panel.querySelector('#verify-platforms').onclick = () => check('jump through / land on ledges, solid ground, boosted movement, short hops', async () => {
    await fresh()
    const s = scene(), floor = s.level.floor, [ledgeX, ledgeY, ledgeWidth] = s.level.ledges[0]
    quiet(s)
    s.hero.body.reset(ledgeX + ledgeWidth / 2, floor); s.hero.setVelocity(0, 0)
    await until(() => s.hero.body.blocked.down)
    state.input.jumpQueued = state.input.jump = true
    await until(() => s.hero.body.velocity.y < -400)
    await until(() => s.hero.body.blocked.down && s.hero.y < ledgeY + 14)
    if (Math.abs(s.hero.body.bottom - ledgeY) > 2) throw new Error('Did not land on the first ledge from underneath')
    state.input.jump = false
    state.input.right = true
    await until(() => s.hero.x > ledgeX + ledgeWidth + PLAYER.bodyWidth + 5)
    resetInput(); await until(() => s.hero.body.blocked.down)
    if (Math.abs(s.hero.body.bottom - floor) > 2) throw new Error('Ground lost its solid collision')
    s.hero.body.reset(s.level.start, floor); s.hero.setVelocity(0, 0); s.loadout.speed = true
    await until(() => s.hero.body.blocked.down && Math.abs(s.hero.body.bottom - floor) < 1) // let physics settle after the move
    state.input.right = true
    const bodyWidth = s.hero.body.width, origin = s.hero.originY
    const poses = new Set(), start = s.playTime
    await until(() => s.playTime > start + 1400, 4000, () => {
      poses.add(s.hero.texture.key)
      if (s.hero.body.width !== bodyWidth || s.hero.originY !== origin) throw new Error('Animation changes Ozo’s collision size or origin')
      if (Math.abs(s.hero.body.bottom - floor) > 2) throw new Error('Ozo jitters vertically during boosted movement')
    })
    if (poses.size < 4 || s.hero.body.velocity.x !== PLAYER.happyFeetRunSpeed) throw new Error('Boosted run does not animate')
    // A tap gives a short hop; holding jump gives the full jump.
    resetInput(); s.loadout.speed = false
    const apex = async hold => {
      s.hero.body.reset(s.level.start, floor); s.hero.setVelocity(0, 0)
      await until(() => s.hero.body.blocked.down && Math.abs(s.hero.body.bottom - floor) < 1)
      state.input.jumpQueued = true; state.input.jump = hold
      let top = floor
      await until(() => !s.hero.body.blocked.down)
      await until(() => s.hero.body.blocked.down, 3000, () => { top = Math.min(top, s.hero.body.bottom) })
      state.input.jump = false
      return floor - top
    }
    const tap = await apex(false), held = await apex(true)
    if (tap > held - 25 || tap < 70) throw new Error(`Short hop wrong: tap rose ${Math.round(tap)} px, held rose ${Math.round(held)} px`)
    resetInput(); s.pauseRun()
  })
  panel.querySelector('#verify-checkpoint').onclick = () => check('checkpoint: start at the flag before the wall, earlier loot kept, full restart forgets it', async () => {
    await fresh()
    const s = scene(), L = s.level
    quiet(s)
    collect('coins'); collect('coins') // picked up before the flag: kept
    s.hero.body.reset(L.checkpoint + 10, L.floor)
    await until(() => s.checkpointReached)
    if (state.checkpoint?.coins !== 2) throw new Error('Checkpoint did not remember the loot so far')
    collect('coins') // picked up after the flag: lost
    s.die('Test')
    await until(() => state.mode === 'dead')
    if (!document.querySelector('[data-action="checkpoint"]')) throw new Error('Death card does not offer the checkpoint')
    s.restartFromCheckpoint()
    await until(() => state.mode === 'playing' && s.hero.x > L.checkpoint - 5 && state.health === PLAYER.hearts)
    // The wall was still standing when Ozo touched the flag, so it stands again.
    if (s.wallBroken || !s.wallCollider.body.enable) throw new Error('Wall was not standing at the flag, but is down after it')
    if (s.enemies.getChildren().some(e => e.x < L.checkpoint)) throw new Error('Enemies behind the checkpoint came back')
    // Nothing may be able to reach the flag without the wall in between.
    const unshielded = s.enemies.getChildren().filter(e => e.x < L.wall.x && Math.abs(e.x - L.checkpoint) < ENEMIES.spitter.fireRange)
    if (unshielded.length) throw new Error(`An enemy at x=${Math.round(unshielded[0].x)} can reach the flag`)
    if (state.run.coins !== 2) throw new Error(`Expected the 2 coins from before the flag, got ${state.run.coins}`)
    s.startRun()
    await until(() => state.mode === 'playing' && s.hero.x < L.start + 20)
    if (state.checkpoint || !s.wallCollider.body.enable) throw new Error('A full restart did not forget the checkpoint')
    s.pauseRun()
  })
}
