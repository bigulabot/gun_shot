// Level 01: Canopy Coast. Positions are world pixels; x grows to the right,
// y grows downwards. The screen is 1280 × 720 and the camera scrolls sideways.
//
// Pacing: one new idea per stretch, each with room to try it before it matters.
//   0–1900     move (coins on the ground), then jump (coins on a ledge), first small gap
//   2000–3200  shoot (first Snapper), optional ledges with research
//   3320–4100  dodge pink shots (first Spitter), Snapper
//   4220–5200  heart up high, the wall, Spitter behind it
//   5330–6570  everything together, climbing higher (a Snapper on a high
//              platform, a secret stash in the cloud beside it), then home
export default {
  id: '01',
  name: 'CANOPY COAST',
  width: 6570,
  floor: 575, // top of the ground
  start: 170, // Ozo's starting x
  starTime: 75, // seconds: finish faster than this for the "quick" star
  // Behind the main menu the camera drifts between these x positions: the
  // menu's big Ozo must always have ground under him, never a pit.
  menuPan: [1100, 2100],
  // Look and sound: sky colour, birds, which music plays.
  theme: { sky: '#9ad8f0', birds: true, music: 'jungle' },

  // Solid ground: [x, width]. The spaces between them are pits.
  ground: [[0, 1900], [2000, 1200], [3320, 780], [4220, 980], [5330, 1240]],

  // Floating ledges: [x, y, width, height = 25]. Jump up through them from
  // below, land on top.
  ledges: [
    [1500, 466, 150], // jump practice
    [2850, 466, 140], [3000, 400, 140],
    [3400, 466, 150],
    [4280, 500, 200], [4340, 400, 120], // steps up to the heart
    [4830, 466, 150],
    [5700, 466, 160], [5930, 400, 160],
    [6090, 320, 190], // the high platform with a Snapper on it
  ],

  // Enemies: [x, type, patrol left edge, patrol right edge, y of the platform
  // it stands on (leave out for the ground)]. Patrols stay well inside a
  // platform so knockback never pushes an enemy off.
  enemies: [
    [2650, 'snapper', 2500, 2800], [3600, 'spitter', 3600, 3600],
    [3900, 'snapper', 3750, 4000], [5000, 'spitter', 5000, 5000],
    [5530, 'snapper', 5430, 5630], [6000, 'spitter', 6000, 6000],
    [6185, 'snapper', 6150, 6220, 320], // up high: needed for the "every critter" star
  ],

  // Big clouds drawn in front of pickups: [centre x, centre y, width, height].
  // Loot placed inside one is a secret stash (one coin peeks out as a clue).
  clouds: [[6320, 222, 240, 84]],

  // Pickups placed in the level: [x, y, 'coins' | 'research' | 'heart'].
  // A heart gives back one lost heart (it stays put while Ozo's hearts are full).
  pickups: [
    [700, 555, 'coins'], [760, 555, 'coins'], [820, 555, 'coins'],
    [1545, 430, 'coins'], [1605, 430, 'coins'],
    [3070, 364, 'research'],
    [3445, 430, 'coins'], [3505, 430, 'coins'],
    [4400, 370, 'heart'],
    [4870, 430, 'coins'], [4930, 430, 'coins'],
    [5995, 364, 'research'],
    // Secret stash inside the cloud beside the high platform
    [6218, 266, 'coins'], // peeking out of the bottom of the cloud
    [6255, 228, 'coins'], [6295, 212, 'coins'], [6335, 228, 'coins'], [6375, 212, 'coins'],
    [6315, 196, 'research'], [6395, 240, 'research'],
  ],

  // Breakable wall standing on the ground. Its stones are 50 × 44 each.
  wall: { x: 4650, columns: 2, rows: 6, hintFrom: 4120 },

  // Checkpoint flag just after the pit jump, before the heart ledges and the
  // wall (which shields it from the Spitter behind). After touching it, a lost
  // life starts again here with the loot from before it kept; the wall is as
  // it was at the flag, so usually still standing.
  checkpoint: 4245,

  // Reach this x (on the ground) with the wall broken to finish.
  exit: 6380,

  // Tutorial text in the sky: [x, y, keyboard text, touch text (if different)]
  tips: [
    [450, 190, 'MOVE WITH ← →', 'MOVE WITH THE STICK'],
    [1450, 230, 'SPACE TO JUMP · HOLD IT TO GO HIGHER', 'TAP JUMP · HOLD IT TO GO HIGHER'],
    [2450, 190, 'HOLD X TO SHOOT', 'HOLD FIRE TO SHOOT'],
    [3260, 170, 'JUMP OVER PINK SHOTS'],
    [4410, 250, 'HEARTS HEAL YOU'],
    [4700, 150, 'SHOOT THE WALL TO BREAK IT'],
    [5790, 190, 'ALMOST HOME →'],
  ],
}
