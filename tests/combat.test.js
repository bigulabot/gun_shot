import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sweep, rangeEnd, canLandOnPlatform, shotRange, enemyHealth, WALL_HEALTH } from '../src/game/combat.js'

const box = (x, y, nextX = x, nextY = y, radius = 5) => ({ prev: { x, y }, x: nextX, y: nextY, halfWidth: radius, halfHeight: radius })

test('fast opposing shots collide even when they swap sides within one frame', () => {
  assert.equal(sweep(box(0, 0, 80), box(70, 0, 30)), 0.5)
  assert.equal(sweep(box(80, 0, 0), box(10, 0, 50)), 0.5)
})
test('shots with different heights and shots travelling apart do not collide', () => {
  assert.equal(sweep(box(0, 0, 80), box(70, 25, 30, 25)), null)
  assert.equal(sweep(box(0, 0, -10), box(70, 0, 90)), null)
})
test('sweeps handle initial overlap, stationary axes, diagonal travel, and moving targets', () => {
  assert.equal(sweep(box(0, 0), box(1, 0)), 0)
  assert.equal(sweep(box(0, 0), box(30, 0)), null)
  assert.equal(sweep(box(0, 0, 40, 40), box(30, 30)), 0.5)
  assert.equal(sweep(box(0, 0, 100), box(80, 0, 100)), 0.875)
})
test('nearer obstacles are hit before enemies behind them', () => {
  const bullet = box(0, 0, 100)
  assert.ok(sweep(bullet, box(40, 0)) < sweep(bullet, box(80, 0)))
})
test('range expires by distance at the correct point within a frame', () => {
  assert.equal(rangeEnd(350, 20, 360), 0.5)
  assert.equal(rangeEnd(360, 0, 360), 0)
  assert.equal(rangeEnd(100, 0, 360), null)
  assert.equal(rangeEnd(350, 20, 540), null)
  assert.equal(shotRange(false), 360)
  assert.equal(shotRange(true), 540)
})
test('one-way ledges allow rising through, landing above, and entering from below', () => {
  const platform = { oneWay: true, body: { top: 466 } }
  assert.equal(canLandOnPlatform({ velocity: { y: -150 }, prev: { y: 450 }, height: 65 }, platform), false)
  assert.equal(canLandOnPlatform({ velocity: { y: 100 }, prev: { y: 400 }, height: 65 }, platform), true)
  assert.equal(canLandOnPlatform({ velocity: { y: 100 }, prev: { y: 430 }, height: 65 }, platform), false)
  assert.equal(canLandOnPlatform({ velocity: { y: -150 }, prev: { y: 450 }, height: 65 }, { ...platform, oneWay: false }), true)
})
test('both enemy types and the wall survive a single upgraded shot', () => {
  assert.equal(enemyHealth('snapper'), 4)
  assert.equal(enemyHealth('spitter'), 6)
  assert.ok(enemyHealth('snapper') > 2 && enemyHealth('spitter') > 2 && WALL_HEALTH > 2)
})
