import assert from 'node:assert/strict'
import { test } from 'node:test'

let caseId = 0
async function session(initial = null, unavailable = false) {
  let saved = initial
  globalThis.localStorage = {
    getItem() { if (unavailable) throw new Error('Storage blocked'); return saved },
    setItem(_, value) { if (unavailable) throw new Error('Storage blocked'); saved = value },
  }
  const api = await import(`../src/game/state.js?test=${++caseId}`)
  return { ...api, saved: () => saved }
}

test('broken saves and invalid values produce a playable starting profile', async () => {
  const broken = await session('not valid JSON')
  assert.equal(broken.state.profile.coins, 0)
  const invalid = await session(JSON.stringify({ coins: -30, research: 5.5, upgrades: { dash: 'yes' }, equipped: 'twin' }))
  assert.equal(invalid.state.profile.coins, 0)
  assert.equal(invalid.state.profile.research, 0)
  assert.equal(invalid.state.profile.upgrades.dash, false)
  assert.equal(invalid.state.profile.equipped, 'pop')
})

test('purchases cannot overspend, charge twice, or debit the wrong currency', async () => {
  const api = await session()
  api.state.profile.coins = 9
  api.state.profile.research = 4
  assert.equal(api.purchase('power'), false)
  assert.equal(api.state.profile.coins, 9)
  assert.equal(api.purchase('jump'), true)
  assert.equal(api.state.profile.research, 0)
  assert.equal(api.state.profile.coins, 9)
  assert.equal(api.purchase('jump'), false)
  assert.equal(api.purchase('unknown'), false)
  assert.equal(api.state.profile.research, 0)
})

test('earned currency, upgrades and gun selection survive a new session', async () => {
  const first = await session()
  first.beginRun()
  for (let i = 0; i < 20; i++) first.collect('coins')
  for (let i = 0; i < 5; i++) first.collect('research')
  first.bankRun()
  assert.equal(first.purchase('twin'), true)
  assert.equal(first.purchase('jump'), true)
  const second = await session(first.saved())
  assert.equal(second.state.profile.coins, 4)
  assert.equal(second.state.profile.research, 1)
  assert.equal(second.state.profile.equipped, 'twin')
  assert.equal(second.state.profile.upgrades.jump, true)
  assert.equal(second.state.run.coins, 0)
  assert.equal(second.state.health, 3)
})

test('storage restrictions and verification mode do not interrupt play or overwrite saves', async () => {
  const blocked = await session(null, true)
  blocked.beginRun()
  assert.doesNotThrow(() => { blocked.collect('research'); blocked.bankRun() })
  assert.equal(blocked.state.profile.research, 1)
  const original = JSON.stringify({ coins: 42 })
  const verification = await session(original)
  verification.state.persistenceEnabled = false
  verification.beginRun()
  verification.collect('coins')
  verification.bankRun()
  assert.equal(verification.state.profile.coins, 43)
  assert.equal(verification.saved(), original)
})

test('old saves default range to locked; Long shot costs coins and persists', async () => {
  const first = await session(JSON.stringify({ coins: 20, research: 4, upgrades: { speed: true } }))
  assert.equal(first.state.profile.upgrades.range, false)
  assert.equal(first.state.profile.upgrades.speed, true)
  assert.equal(first.purchase('range'), true)
  assert.equal(first.state.profile.coins, 12)
  assert.equal(first.state.profile.research, 4)
  assert.equal(first.purchase('range'), false)
  const second = await session(first.saved())
  assert.equal(second.state.profile.upgrades.range, true)
  assert.equal(second.state.profile.upgrades.speed, true)
})

test('loot only counts once the level is finished', async () => {
  const api = await session(JSON.stringify({ coins: 5, research: 1 }))
  api.beginRun(6)
  api.collect('coins'); api.collect('coins'); api.collect('research')
  assert.equal(api.state.profile.coins, 5, 'not added while the level is in progress')
  assert.equal(api.wallet('coins'), 7, 'but the HUD shows it')
  assert.equal(api.saved(), JSON.stringify({ coins: 5, research: 1 }), 'and nothing is saved yet')
  api.loseRun()
  assert.equal(api.wallet('coins'), 5, 'a failed level loses its loot')
  api.collect('coins')
  assert.equal(api.wallet('coins'), 5, 'nothing is collected after failing')
  api.beginRun(6)
  api.collect('coins'); api.collect('research')
  api.bankRun(); api.bankRun()
  assert.equal(api.state.profile.coins, 6, 'finishing adds the loot once')
  assert.equal(api.state.profile.research, 2)
  assert.equal(JSON.parse(api.saved()).coins, 6)
})

test('reset save returns everything to a fresh start but keeps the sound setting', async () => {
  const api = await session(JSON.stringify({ coins: 40, research: 20, upgrades: { twin: true, jump: true }, equipped: 'twin', sound: false, best: 42 }))
  api.resetProfile()
  assert.equal(api.state.profile.coins, 0)
  assert.equal(api.state.profile.research, 0)
  assert.equal(Object.values(api.state.profile.upgrades).some(Boolean), false)
  assert.equal(api.state.profile.equipped, 'pop')
  assert.equal(api.state.profile.best, null)
  assert.equal(api.state.profile.sound, false)
  assert.equal(JSON.parse(api.saved()).coins, 0)
})
