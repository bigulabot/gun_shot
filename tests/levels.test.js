// Checks every level's layout against Ozo's real jump, using the numbers in
// tuning.js: no gap too wide to jump without a raft, every ledge and the key
// reachable without upgrades, enemies that can't walk or hop off their ground,
// and flags, doors and home standing on solid ground. The ?verify=1 route
// checks then play each level for real.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LEVELS } from '../src/levels/index.js'
import { PLAYER, WORLD } from '../src/game/tuning.js'

const APEX = PLAYER.jumpVelocity ** 2 / (2 * WORLD.gravity) // how high a full jump rises
const AIRTIME = 2 * PLAYER.jumpVelocity / WORLD.gravity
const JUMP_DISTANCE = PLAYER.runSpeed * AIRTIME // how far a running jump goes
const ENEMY_HALF_WIDTH = 27 // enemy bodies are 53 px wide
const KNOCKBACK_ROOM = 30 // Snappers can be pushed this far past their patrol

const onGround = (L, x, margin = 0) => L.ground.some(([gx, width]) => x - margin >= gx && x + margin <= gx + width)
const gapsOf = L => L.ground.slice(0, -1).map(([x, width], i) => ({ start: x + width, end: L.ground[i + 1][0] }))
const raftOver = (L, gap) => (L.movers ?? []).find(([x, , width, dx]) => x <= gap.start + 25 && x + dx + width >= gap.end - 25)

for (const L of LEVELS) {
  test(`level ${L.id}: every gap can be jumped, or has a raft across it`, () => {
    assert.ok(L.ground.every(([x], i) => i === 0 || x > L.ground[i - 1][0] + L.ground[i - 1][1]), 'ground pieces are in order and don\'t overlap')
    for (const gap of gapsOf(L)) {
      const width = gap.end - gap.start
      if (raftOver(L, gap)) continue
      // A running jump must clear the gap with room for Ozo's body and a late take-off.
      assert.ok(width <= JUMP_DISTANCE - PLAYER.bodyWidth - 20, `gap at ${gap.start} is ${width} px wide: too far to jump (${Math.round(JUMP_DISTANCE)} px max)`)
    }
  })

  test(`level ${L.id}: every ledge and the key can be reached without upgrades`, () => {
    // Surfaces Ozo can stand on: the ground, ledges, and rafts anywhere along their path.
    const surfaces = [
      ...L.ground.map(([x, width]) => ({ x, width, y: L.floor })),
      ...L.ledges.map(([x, y, width]) => ({ x, width, y })),
      ...(L.movers ?? []).map(([x, y, width, dx]) => ({ x, width: width + dx, y })),
    ]
    for (const [x, y, width] of L.ledges) {
      const from = surfaces.find(s => s.y > y && s.y - y <= APEX - 8 && s.x < x + width + 150 && s.x + s.width > x - 150)
      assert.ok(from, `ledge at ${x},${y} is out of reach: nothing to jump from within ${Math.round(APEX - 8)} px below it`)
    }
    if (L.key) {
      const [kx, ky] = L.key
      const ledge = L.ledges.find(([x, y, width]) => kx >= x && kx <= x + width && y > ky)
      assert.ok(ledge && ledge[1] - ky < PLAYER.bodyHeight, 'the key floats low enough over its ledge to touch')
    }
  })

  test(`level ${L.id}: enemies stay on their ground or platform`, () => {
    for (const [x, type, min, max, y] of L.enemies) {
      assert.ok(min <= x && x <= max, `${type} at ${x} starts inside its patrol`)
      const room = ENEMY_HALF_WIDTH + (type === 'snapper' ? KNOCKBACK_ROOM : 0)
      if (y === undefined) {
        assert.ok(onGround(L, min, room) && onGround(L, max, room) && L.ground.some(([gx, w]) => min - room >= gx && max + room <= gx + w), `${type} at ${x} could leave its piece of ground`)
      } else {
        const ledge = L.ledges.find(([lx, ly, w]) => ly === y && min - room >= lx && max + room <= lx + w)
        assert.ok(ledge, `${type} at ${x} is not safely on a platform at y ${y}`)
      }
    }
  })

  test(`level ${L.id}: flag, door, home and the menu view stand on solid ground`, () => {
    assert.match(L.id, /^\d{2}$/)
    assert.ok(L.starTime > 0, 'has a star time')
    assert.ok(onGround(L, L.start, 20), 'Ozo starts on the ground')
    if (L.checkpoint) assert.ok(onGround(L, L.checkpoint, 20), 'checkpoint flag on the ground')
    assert.ok(onGround(L, L.exit, 45), 'birdhouse on the ground')
    assert.ok(Boolean(L.wall) !== Boolean(L.door), 'a level has a wall to break or a locked door, not both')
    if (L.door) {
      assert.ok(onGround(L, L.door.x, 40), 'door on the ground')
      assert.ok(L.key && L.key[0] < L.door.x, 'the key comes before the door')
      assert.ok(!L.checkpoint || L.checkpoint < L.key[0], 'the flag is before the key, so the key is always there to get')
    }
    // The main menu's big Ozo stands where screen x 960–1024 meets the ground.
    const [from, to] = L.menuPan
    assert.ok(L.ground.some(([gx, w]) => from + 960 >= gx && to + 1024 <= gx + w), 'the menu drift keeps big Ozo over one piece of ground')
  })
}

test('level ids are unique', () => {
  assert.equal(new Set(LEVELS.map(({ id }) => id)).size, LEVELS.length)
})
