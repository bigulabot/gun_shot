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
  // Finlay's Mushy: walks to and fro. When Ozo comes close it crouches ("!"),
  // fires its cap at where he's standing, then sinks into the ground and is
  // gone: one attack only. The cap explodes where it lands. Shoot Mushy before
  // it fires to beat it (and to count it for the "every critter" star).
  mushy: {
    health: 2,
    walkSpeed: 40,
    fireRange: 330, // fires when Ozo is this close (just inside Ozo's 360 range: rush in and it fires first)
    windUp: 450, // crouching "!" before the cap flies
    capFlightTime: 0.85, // seconds for the cap to reach where Ozo was
    capGravity: 900, // how steeply the cap arcs
    blastRadius: 85, // Ozo is hurt if he's this close when it explodes
    burrowTime: 700, // ms to sink into the ground after firing
  },
  // Finlay's Spike: rolls to and fro and hurts to touch. Shots don't hurt it
  // while it has its spikes: instead it flings them out in a ring (dodge
  // them!) and stops, bald. Then shots hurt, until its spikes grow back.
  spike: {
    health: 3,
    rollSpeed: 110,
    spikes: 8, // flung out evenly all round
    spikeSpeed: 300,
    spikeGravity: 600, // they arc up and fall back down
    baldTime: 2600, // stopped and bald: shots hurt it
    regrowTime: 450, // spikes growing back (flashing), then it rolls again
  },
  // Saved for later (Finlay's call): two more critter abilities, not in any
  // level yet. They borrow Mushy's and Spike's pictures until they get their own.
  // Hopper: crouches with a "!", then hops towards Ozo. In the air it's above
  // his shots, so he has to hit it when it lands.
  hopper: {
    health: 3,
    noticeRange: 380, // starts hopping towards Ozo inside this distance
    hopEvery: 1300, // ms between hops (counted from each landing)
    squashTime: 220, // it crouches this long before each hop (a warning)
    hopSpeed: 150, // sideways speed during a hop (about 100 px per hop)
    hopVelocity: 520, // upward speed: hops about 85 px high
  },
  // Curler: stays put. Open (can be hit) -> glows (warning) -> fires a
  // spread of burrs -> curls up (shots bounce off) -> open again.
  curler: {
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
