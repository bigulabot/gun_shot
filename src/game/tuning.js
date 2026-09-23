// Every gameplay number lives here. Distances are world pixels, speeds are
// pixels per second, times are milliseconds. Change a value, save, and the dev
// server reloads the game. Level layout is in src/levels/.

export const WORLD = {
  gravity: 1600,
  // Physics runs in fixed 1/240 s steps, so jumps and shots behave the same on
  // a 30 fps tablet and a 144 Hz monitor.
  physicsFps: 240,
}

export const PLAYER = {
  hearts: 3,
  runSpeed: 260,
  happyFeetRunSpeed: 299, // "Happy feet" upgrade
  jumpVelocity: 625, // apex ≈ velocity² / (2 × gravity) ≈ 122 px
  springStepJumpVelocity: 670, // "Spring step" upgrade, apex ≈ 140 px
  // Short hops: letting go of jump while still rising slows the rise to this,
  // but only after the jump has lasted shortHopTime. Even the quickest tap
  // clears every pit (about 80 px high, 160 px far); holding gives full height.
  jumpCutVelocity: 300,
  shortHopTime: 100,
  maxFallSpeed: 1000,
  coyoteTime: 105, // can still jump this long after running off an edge
  jumpBuffer: 140, // a jump pressed this long before landing still counts
  dashSpeed: 570,
  dashTime: 160,
  dashCooldown: 950,
  glideFallSpeed: 115,
  hurtProtection: 1500, // flashing, can't be hurt again
  knockbackTime: 180,
  knockbackX: 180,
  knockbackY: 190,
  // Collision box. Feet are at the sprite's origin.
  bodyWidth: 36,
  bodyHeight: 65,
}

export const CAMERA = {
  lookAhead: 120, // how far the camera looks ahead of Ozo, in the direction he faces
  turnTime: 550, // how quickly it swings round when he turns (higher = slower)
  // Behind the main menu the level drifts along and back (each level sets
  // where, in its `menuPan`), taking this long each way.
  menuPanTime: 40000,
}

export const BLASTER = {
  shotSpeed: 780,
  range: 360,
  longShotRange: 540, // "Long shot" upgrade
  damage: 1,
  popPowerDamage: 2, // "Pop power" upgrade
  cooldown: 235,
  twinCooldown: 320, // Twin Pop fires two shots per cooldown
  twinGap: 80, // time between the two Twin Pop shots
}

export const ENEMIES = {
  snapper: {
    health: 4,
    patrolSpeed: 48,
    chaseSpeed: 89,
    noticeRange: 330, // turns towards Ozo inside this distance
    chaseRange: 290, // speeds up inside this distance
    knockback: 180, // pushed back this fast when hit...
    knockbackTime: 120, // ...for this long
  },
  spitter: {
    health: 6,
    fireRange: 520, // only shoots when Ozo is this close (horizontally)
    windUp: 700, // warning pose before each shot
    reload: 2150,
    shotSpeed: 185,
    shotRange: 600,
  },
  // Finlay's Hatter: hops towards Ozo. In the air it's above his shots, so
  // he has to hit it when it lands.
  hatter: {
    health: 3,
    noticeRange: 380, // starts hopping towards Ozo inside this distance
    hopEvery: 1300, // ms between hops (counted from each landing)
    squashTime: 220, // it crouches this long before each hop (a warning)
    hopSpeed: 150, // sideways speed during a hop (about 100 px per hop)
    hopVelocity: 520, // upward speed: hops about 85 px high
  },
  // Finlay's Spiky: stays put. Open (can be hit) -> glows (warning) -> fires
  // a spread of burrs -> curls up (shots bounce off) -> open again.
  spiky: {
    health: 4,
    fireRange: 470, // only fires when Ozo is this close (horizontally)
    openTime: 1500, // vulnerable, before it starts to glow
    windUp: 650, // glowing warning before the burrs
    curledTime: 1700, // curled up, shots bounce off
    burrs: 3,
    spread: 0.38, // radians between neighbouring burrs
    shotSpeed: 200,
  },
}

export const FEEL = {
  healthBarTime: 2000, // an enemy's health bar shows for this long (ms) after each hit
}

export const WALL = {
  health: 12,
  healthPerRow: 4, // a row of stones falls off every 4 damage
}

export const LOOT = {
  coinsPerEnemy: 1,
  researchPerEnemy: 1,
  coinStreakTime: 700, // coins picked up within this many ms of each other ring higher and higher...
  coinStreakMax: 8, // ...for up to this many steps
  magnetRadius: 60, // coins and research drift to Ozo inside this distance
  magnetSpeed: 400,
}
