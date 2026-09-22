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

export function cleanProfile(value = {}) {
  const amount = (v) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 999999) : 0
  return {
    research: amount(value.research),
    coins: amount(value.coins),
    upgrades: Object.fromEntries(upgrades.map(({ id }) => [id, value.upgrades?.[id] === true])),
    equipped: value.upgrades?.twin === true && value.equipped === 'twin' ? 'twin' : 'pop',
    sound: value.sound !== false,
    best: Number.isFinite(value.best) && value.best > 0 ? value.best : null,
  }
}

function loadProfile() {
  try { return cleanProfile(JSON.parse(localStorage.getItem(SAVE_KEY)) || {}) }
  catch { return cleanProfile() }
}

export const state = {
  mode: 'loading', profile: loadProfile(), health: 3, persistenceEnabled: true,
  input: { left: false, right: false, jump: false, shoot: false, dash: false, jumpQueued: false, dashQueued: false, shootQueued: false },
  run: { coins: 0, research: 0, defeated: 0, seconds: 0 },
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

export function collect(currency) {
  state.profile[currency] += 1
  state.run[currency] += 1
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
