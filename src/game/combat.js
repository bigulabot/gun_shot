// Pure rules shared by the scene and regression tests (world distances in pixels).
// The numbers themselves live in tuning.js.
import { BLASTER, ENEMIES, WALL } from './tuning.js'

export const SHOT_RANGE = BLASTER.range
export const LONG_SHOT_RANGE = BLASTER.longShotRange
export const ENEMY_SHOT_RANGE = ENEMIES.spitter.shotRange
export const WALL_HEALTH = WALL.health
export const enemyHealth = kind => ENEMIES[kind].health
export const shotRange = upgraded => upgraded ? LONG_SHOT_RANGE : SHOT_RANGE

export function canLandOnPlatform(body, platform) {
  return !platform.oneWay || (body.velocity.y >= 0 && body.prev.y + body.height <= platform.body.top + 2)
}

// Time of impact, 0..1, for two moving axis-aligned boxes. Unlike an overlap
// at the end of a frame this catches fast shots crossing between frames.
export function sweep(a, b) {
  let enter = 0, leave = 1
  for (const axis of ['x', 'y']) {
    const extent = axis === 'x' ? 'halfWidth' : 'halfHeight'
    const start = a.prev[axis] - b.prev[axis]
    const travel = (a[axis] - a.prev[axis]) - (b[axis] - b.prev[axis])
    const radius = a[extent] + b[extent]
    if (Math.abs(travel) < 1e-8) {
      if (Math.abs(start) > radius) return null
      continue
    }
    const t1 = (-radius - start) / travel, t2 = (radius - start) / travel
    enter = Math.max(enter, Math.min(t1, t2))
    leave = Math.min(leave, Math.max(t1, t2))
    if (enter > leave) return null
  }
  return enter
}

export function bodySweep(body) {
  const x = body.center.x, y = body.center.y
  return { x, y, halfWidth: body.halfWidth, halfHeight: body.halfHeight,
    prev: body.prev ? { x: body.prev.x + body.halfWidth, y: body.prev.y + body.halfHeight } : { x, y } }
}

export function rangeEnd(travelled, remainingStep, range) {
  if (travelled >= range) return 0
  return travelled + remainingStep >= range ? (range - travelled) / remainingStep : null
}
