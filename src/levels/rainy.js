// Level 02: Rainy Ridge. Same rainforest, but grey and rainy, a bit harder,
// with Finlay's Mushies and Spikes. Instead of a wall to shoot down there is
// a locked door: its key sits above a pit you can only cross on a moving raft.
// Positions are world pixels; x grows to the right, y grows downwards.
//
// Pacing:
//   0–1420     meet a Mushy (fires its cap if you let it), first small gap
//   1420–2900  ledges with loot, a Snapper, the first Spike, another Mushy
//   3030–3900  a Spitter, then the checkpoint flag
//   3900–4420  the key: ride the raft, jump up to the key ledge, drop back on
//   4420–5600  heart up high, a Spike and a Mushy guard the locked door
//   5740–7400  climb to a bonus Spike and a secret stash, then home
export default {
  id: '02',
  name: 'RAINY RIDGE',
  width: 7400,
  floor: 575, // top of the ground
  start: 170,
  starTime: 100, // seconds: finish faster than this for the "quick" star
  menuPan: [500, 1850], // see canopy.js
  // Grey rainy sky, background and ground darkened (multiplied by `tint` and
  // `groundTint`), rain, grey clouds, no birds, and the rainy tune.
  theme: {
    sky: '#8ea7b5', tint: 0xa3b7c1, groundTint: 0xc3ced3, rain: true, birds: false, music: 'rain',
    cloud: [0xe6ecef, 0xb8c6ce], // tip clouds: fill, shadow
    rainClouds: [[300, 60, 520], [1300, 30, 640], [2400, 70, 560], [3500, 40, 700], [4700, 60, 600], [5900, 35, 680], [7000, 65, 520]],
    puddles: [[560, 70], [1560, 56], [2320, 84], [3240, 60], [4560, 72], [5020, 56], [6120, 80], [6860, 64]],
  },

  // Solid ground: [x, width]. The spaces between them are pits.
  ground: [[0, 1300], [1420, 1480], [3030, 870], [4420, 1180], [5740, 1660]],

  // Floating ledges: [x, y, width, height = 25]. Jump up through them from
  // below, land on top.
  ledges: [
    [1650, 466, 140], [1850, 400, 140],
    [4100, 470, 110], // the key ledge, above the middle of the raft pit (a full jump up from the raft)
    [4650, 466, 150], // heart
    [6250, 466, 140], [6380, 380, 190], // steps up to the bonus Spike
  ],

  // Moving platforms: [x, y, width, move x, move y, ms for a full trip there
  // and back]. Ozo rides on top. This raft floats level with the ground and
  // carries him across the key pit: step on when it reaches the edge.
  movers: [[3905, 575, 150, 350, 0, 6000]],

  // Enemies: [x, type, patrol left edge, patrol right edge, y of the platform
  // it stands on (leave out for the ground)]. Mushies walk their patrol;
  // Spikes roll along it.
  enemies: [
    [1000, 'mushy', 880, 1180],
    [2000, 'snapper', 1900, 2150], [2500, 'spike', 2350, 2700], [2770, 'mushy', 2720, 2840],
    [3300, 'spitter', 3300, 3300],
    [4950, 'spike', 4800, 5150], [5220, 'mushy', 5180, 5300],
    [6000, 'snapper', 5900, 6150],
    [6475, 'spike', 6440, 6510, 380], // bonus, up high
  ],

  // Big clouds drawn in front of pickups; loot inside one is a secret stash.
  clouds: [[6680, 250, 220, 80]],

  // Pickups: [x, y, 'coins' | 'research' | 'heart'].
  pickups: [
    [640, 555, 'coins'], [690, 555, 'coins'], [740, 555, 'coins'],
    [1690, 430, 'coins'], [1740, 430, 'coins'], [1920, 364, 'research'],
    [2280, 555, 'coins'], [3150, 555, 'coins'], [3200, 555, 'coins'],
    [4725, 430, 'heart'],
    [5850, 555, 'coins'], [5900, 555, 'coins'],
    [6300, 430, 'research'],
    // Secret stash inside the cloud by the bonus Spike
    [6592, 290, 'coins'], // peeking out of the bottom of the cloud
    [6625, 250, 'coins'], [6665, 232, 'coins'], [6705, 250, 'coins'], [6745, 232, 'coins'],
    [6685, 216, 'research'],
  ],

  // The key floats above its ledge: [x, y]. The door is a doorway in a tree
  // trunk too tall to jump over; it opens when Ozo reaches it with the key.
  key: [4155, 440],
  door: { x: 5400, hintFrom: 5050 },

  // Checkpoint flag on solid ground just before the raft pit. Everything
  // behind it counts as done when starting again from it.
  checkpoint: 3780,

  exit: 7200,

  // Tutorial text in the sky: [x, y, keyboard text, touch text (if different)]
  tips: [
    [520, 180, 'NEW CRITTERS LIVE HERE'],
    [980, 160, 'MUSHY FIRES ITS CAP · SHOOT IT FIRST!'],
    [2380, 170, 'SHOOT SPIKE, DODGE ITS SPIKES, THEN HIT IT'],
    [3650, 150, 'RIDE THE RAFT · JUMP UP FOR THE KEY'],
    [5180, 150, 'THE KEY OPENS THE DOOR'],
    [7000, 190, 'ALMOST HOME →'],
  ],
}
