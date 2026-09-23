export const events = new EventTarget()
export const emit = (name, detail) => events.dispatchEvent(new CustomEvent(name, { detail }))
const SAVE_KEY = 'gun-shot-ozo-v1'

export const upgrades = [
  { id: 'jump', name: 'Spring step', icon: '↟', description: 'Jump a little higher. Every jump still works without it.', currency: 'research', cost: 4 },
  { id: 'speed', name: 'Happy feet', icon: '»', description: 'Run 15% faster. More zip, same big beak.', currency: 'research', cost: 4 },
  { id: 'dash', name: 'Feather dash', icon: '➜', description: 'Unlock a quick dash. Tap DASH or press Shift.', currency: 'research', cost: 7 },
  { id: 'glide', name: 'Easy breezy', icon: '≋', description: 'Hold JUMP while falling to glide gently down.', currency: 'research', cost: 7 },
  { id: 'power', name: 'Pop power', icon: '✦', description: 'Your shots do twice the damage.', currency: 'coins', cost: 10 },
  { id: 'range', name: 'Long shot', icon: '→', description: 'Your pops travel 50% farther: 540 instead of 360.', currency: 'coins', cost: 8 },
  { id: 'twin', name: 'Twin Pop', icon: '••', description: 'A new blaster. Fire two pops in a quick burst.', currency: 'coins', cost: 16 },
]

// Three stars per level, each earned on its own and kept once earned:
// reach home, beat every critter, finish under the level's star time.
export const STARS = [
  { id: 'home', label: 'Reach home' },
  { id: 'critters', label: 'Beat every critter' },
  { id: 'quick', label: 'Be quick' },
]

export function cleanProfile(value = {}) {
  const amount = (v) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 999999) : 0
  const levels = value.stars && typeof value.stars === 'object' ? Object.entries(value.stars) : []
  // Best time in seconds for each level. Older saves had one number, for level 01.
  const bests = typeof value.best === 'number' ? { '01': value.best } : value.best && typeof value.best === 'object' ? value.best : {}
  return {
    research: amount(value.research),
    coins: amount(value.coins),
    upgrades: Object.fromEntries(upgrades.map(({ id }) => [id, value.upgrades?.[id] === true])),
    equipped: value.upgrades?.twin === true && value.equipped === 'twin' ? 'twin' : 'pop',
    sound: value.sound !== false,
    best: Object.fromEntries(Object.entries(bests).filter(([level, seconds]) => /^\d{2}$/.test(level) && Number.isFinite(seconds) && seconds > 0)),
    stars: Object.fromEntries(levels.filter(([level]) => /^\d{2}$/.test(level))
      .map(([level, earned]) => [level, Object.fromEntries(STARS.map(({ id }) => [id, earned?.[id] === true]))])),
  }
}

// Adds a finished run's stars to the level's saved ones. Returns which were new.
export function awardStars(level, earned) {
  const saved = state.profile.stars[level] ??= Object.fromEntries(STARS.map(({ id }) => [id, false]))
  const fresh = STARS.filter(({ id }) => earned[id] && !saved[id]).map(({ id }) => id)
  for (const id of fresh) saved[id] = true
  saveProfile()
  return fresh
}

export const starCount = level => STARS.filter(({ id }) => state.profile.stars[level]?.[id]).length

function loadProfile() {
  try { return cleanProfile(JSON.parse(localStorage.getItem(SAVE_KEY)) || {}) }
  catch { return cleanProfile() }
}

export const state = {
  mode: 'loading', profile: loadProfile(), health: 3, persistenceEnabled: true,
  input: { left: false, right: false, jump: false, shoot: false, dash: false, jumpQueued: false, dashQueued: false, shootQueued: false },
  // Loot picked up during a level. It is only added to the profile when the level is finished.
  run: { coins: 0, research: 0, defeated: 0, enemies: 0, seconds: 0, open: false },
  // Set when Ozo touches the checkpoint: what he had at that moment. Cleared by a full restart.
  checkpoint: null,
}

export function saveProfile() {
  try { if (state.persistenceEnabled) localStorage.setItem(SAVE_KEY, JSON.stringify(state.profile)) }
  catch { /* Play remains available when browser storage is disabled. */ }
  emit('profile')
}

export function resetInput() {
  for (const key of Object.keys(state.input)) state.input[key] = false
  emit('release-input')
}

export function setMode(mode) {
  state.mode = mode
  resetInput()
  emit('mode', mode)
}

export function beginRun(enemies = 0, open = true) {
  state.run = { coins: 0, research: 0, defeated: 0, enemies, seconds: 0, open }
  emit('profile')
}

export function collect(currency) {
  if (!state.run.open) return
  state.run[currency] += 1
  emit('profile')
}

// Level finished: keep this run's loot.
export function bankRun() {
  if (!state.run.open) return
  state.profile.coins = Math.min(999999, state.profile.coins + state.run.coins)
  state.profile.research = Math.min(999999, state.profile.research + state.run.research)
  state.run.open = false
  saveProfile()
}

// Level failed: this run's loot is lost.
export function loseRun() {
  state.run.open = false
  emit('profile')
}

// What the HUD shows: saved totals plus anything picked up in the current run.
export const wallet = currency => state.profile[currency] + (state.run.open ? state.run[currency] : 0)

// For testing: back to a brand-new save (the sound setting is kept).
export function resetProfile() {
  state.profile = { ...cleanProfile(), sound: state.profile.sound }
  saveProfile()
}

export function purchase(id) {
  const item = upgrades.find((entry) => entry.id === id)
  if (!item || state.profile.upgrades[id] || state.profile[item.currency] < item.cost) return false
  state.profile[item.currency] -= item.cost
  state.profile.upgrades[id] = true
  if (id === 'twin') state.profile.equipped = 'twin'
  saveProfile()
  return true
}
