import { events, state, upgrades, purchase, saveProfile, setMode, resetInput, wallet, resetProfile } from './state.js'
import { sound, unlockAudio } from './audio.js'
import { PLAYER } from './tuning.js'

const paths = {
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  jump: '<path d="M12 21V4m-7 7 7-7 7 7M5 21h14"/>',
  shoot: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  dash: '<path d="m11 4 8 8-8 8M2 8h6m-8 4h8m-6 4h6"/>', pause: '<path d="M8 5v14m8-14v14"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M3 9h4l5-5v16l-5-5H3zM17 9l5 6m0-6-5 6"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
}
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.right}</svg>`
const STICK_DEADZONE = 0.25 // how far (0–1) the stick must be pushed before Ozo moves
const BUTTON_REACH = 1.9 // a touch counts for a button within this many button-radii of its centre
const timeLabel = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function setupUI(getScene) {
  const stage = document.querySelector('#stage'), overlay = document.querySelector('#overlay')
  const controls = document.querySelector('#controls'), hud = document.querySelector('#hud')
  const progress = document.querySelector('#level-progress'), toast = document.querySelector('#toast')
  let portrait = '', level = { id: '', name: '' }, deathReason = '', shopReturn = 'title', toastTimer, resetArmed = 0, titleView = 'main'
  const keyboard = new Set(), pointers = new Map()
  const buttons = [...document.querySelectorAll('[data-control]')]
  const bindings = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyX: 'shoot', KeyJ: 'shoot', ShiftLeft: 'dash', ShiftRight: 'dash' }
  function syncInput() {
    const held = new Set([...keyboard].map(key => bindings[key]).concat([...pointers.values()]))
    for (const name of ['left', 'right', 'jump', 'shoot', 'dash']) state.input[name] = state.mode === 'playing' && held.has(name)
    for (const button of buttons) button.classList.toggle('held', state.input[button.dataset.control])
  }
  for (const button of buttons) {
    const action = button.dataset.control, label = { jump: 'JUMP', shoot: 'FIRE', dash: 'DASH' }[action]
    button.innerHTML = `${icon(action)}${label ? `<span>${label}</span>` : ''}`
  }
  // Touches on the game controls are ours alone: no double-tap zoom, magnifier,
  // text selection or callout menu. (Pointer events still arrive as normal.)
  const moveZone = document.querySelector('#move-zone'), actionZone = document.querySelector('#action-zone')
  for (const zone of [moveZone, actionZone]) {
    for (const name of ['touchstart', 'touchend']) zone.addEventListener(name, event => event.preventDefault(), { passive: false })
    zone.addEventListener('contextmenu', event => event.preventDefault())
  }
  const press = (pointerId, action) => {
    if (pointers.get(pointerId) === action) return
    pointers.set(pointerId, action)
    if (action === 'jump') state.input.jumpQueued = true
    if (action === 'dash') state.input.dashQueued = true
    if (action === 'shoot') state.input.shootQueued = true
    syncInput()
  }
  const release = event => { if (pointers.delete(event.pointerId)) syncInput() }

  // Action buttons: a finger presses the nearest visible button it is close to,
  // and can slide from one to another (FIRE to JUMP without lifting). Drifting
  // into empty space keeps the last button held, so a shot or jump never cuts out.
  function nearestButton(x, y) {
    let best = null, bestDistance = Infinity
    for (const button of buttons) {
      if (button.hidden) continue
      const box = button.getBoundingClientRect(), radius = box.width / 2
      const distance = Math.hypot(x - (box.left + radius), y - (box.top + radius)) / radius
      if (distance < BUTTON_REACH && distance < bestDistance) { best = button.dataset.control; bestDistance = distance }
    }
    return best
  }
  actionZone.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing') return
    event.preventDefault(); unlockAudio(); actionZone.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, null) // tracked, even if it starts away from every button
    const action = nearestButton(event.clientX, event.clientY)
    if (action) press(event.pointerId, action)
  })
  actionZone.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return
    const action = nearestButton(event.clientX, event.clientY)
    if (action) press(event.pointerId, action)
  })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) actionZone.addEventListener(name, release)

  // Floating thumbstick: it appears wherever the thumb lands on the left half,
  // and the base slides along behind the thumb if it is dragged past the edge,
  // so turning round never needs a long drag back across a fixed circle.
  const stick = document.querySelector('#stick'), knob = stick.querySelector('.stick-knob')
  let stickPointer = null, origin = null, rest = null
  function moveStick(event) {
    const reach = stick.offsetWidth / 2 * 0.55
    let dx = event.clientX - origin.x, dy = event.clientY - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance > reach) {
      // Drag the base along so the knob stays at the rim under the thumb.
      origin.x += dx * (1 - reach / distance); origin.y += dy * (1 - reach / distance)
      dx = event.clientX - origin.x; dy = event.clientY - origin.y
    }
    stick.style.transform = `translate(${origin.x - rest.x}px, ${origin.y - rest.y}px)`
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    const push = dx / reach
    if (push < -STICK_DEADZONE) pointers.set(event.pointerId, 'left')
    else if (push > STICK_DEADZONE) pointers.set(event.pointerId, 'right')
    else pointers.delete(event.pointerId)
    syncInput()
  }
  function resetStick() {
    if (stickPointer !== null) pointers.delete(stickPointer)
    stickPointer = null
    stick.style.transform = knob.style.transform = ''
    stick.classList.remove('active')
  }
  moveZone.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing' || stickPointer !== null) return
    event.preventDefault(); unlockAudio(); moveZone.setPointerCapture(event.pointerId)
    // Where the stick rests, from layout (offsets ignore the transform it may still be easing back from).
    const zone = moveZone.getBoundingClientRect(), half = stick.offsetWidth / 2
    rest = { x: zone.left + stick.offsetLeft + half, y: zone.top + stick.offsetTop + half }
    origin = { x: event.clientX, y: event.clientY }
    stickPointer = event.pointerId; stick.classList.add('active'); moveStick(event)
  })
  moveZone.addEventListener('pointermove', event => { if (event.pointerId === stickPointer) moveStick(event) })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) moveZone.addEventListener(name, event => { if (event.pointerId === stickPointer) { resetStick(); syncInput() } })

  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !event.repeat) {
      if (state.mode === 'playing') getScene().pauseRun()
      else if (state.mode === 'paused') getScene().resumeRun()
      else if (state.mode === 'shop') setMode(shopReturn)
      else if (state.mode === 'title' && titleView === 'help') showTitle('main')
      return
    }
    if (!bindings[event.code] || state.mode !== 'playing') return
    event.preventDefault(); unlockAudio()
    if (!keyboard.has(event.code)) {
      if (bindings[event.code] === 'jump') state.input.jumpQueued = true
      if (bindings[event.code] === 'dash') state.input.dashQueued = true
      if (bindings[event.code] === 'shoot') state.input.shootQueued = true
    }
    keyboard.add(event.code); syncInput()
  })
  window.addEventListener('keyup', event => { keyboard.delete(event.code); syncInput() })
  events.addEventListener('release-input', () => { keyboard.clear(); pointers.clear(); resetStick(); syncInput() })
  const pauseWhenAway = () => { resetInput(); if (state.mode === 'playing') getScene().pauseRun() }
  window.addEventListener('blur', pauseWhenAway)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseWhenAway() })
  // Turning a phone or tablet upright covers the game with a "turn sideways" hint, so pause.
  const upright = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
  upright.addEventListener('change', () => { if (upright.matches) pauseWhenAway() })
  // iPad/iPhone Safari: no pinch zoom (gesture*) and no double-tap zoom anywhere on the page.
  for (const name of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(name, event => event.preventDefault(), { passive: false })
  const pause = document.querySelector('#pause'); pause.innerHTML = icon('pause'); pause.addEventListener('click', () => getScene().pauseRun())
  const soundButton = document.querySelector('#sound')
  function updateSound() {
    soundButton.innerHTML = icon(state.profile.sound ? 'sound' : 'muted')
    soundButton.setAttribute('aria-label', state.profile.sound ? 'Mute sound' : 'Enable sound')
    soundButton.setAttribute('aria-pressed', String(state.profile.sound))
  }
  soundButton.addEventListener('click', () => { unlockAudio(); state.profile.sound = !state.profile.sound; saveProfile(); updateSound() })
  const fullscreen = document.querySelector('#fullscreen'); fullscreen.innerHTML = icon('fullscreen')
  if (!document.fullscreenEnabled) fullscreen.hidden = true
  fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen() }
    catch { showToast('Fullscreen is unavailable in this browser.') }
  })
  document.addEventListener('fullscreenchange', () => fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'))

  const currency = id => id === 'research' ? '<span class="research">◆</span>' : '<span class="coins">●</span>'
  // Main menu: title and big buttons on the left, Ozo on the right, the level
  // drifting by behind (LevelScene). "How to play" swaps in a help page.
  function renderTitle() {
    if (titleView === 'help') return renderHelp()
    const { research, coins, best } = state.profile
    const stats = [research || coins ? `${currency('research')} ${research} &nbsp; ${currency('coins')} ${coins}` : '', best ? `Best time ${timeLabel(best)}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
    overlay.innerHTML = `<div class="menu">
      <div class="menu-main">
        <h1 class="logo">GUN SHOT</h1>
        <p class="tagline">Ozo's first adventure</p>
        <nav class="menu-buttons" aria-label="Main menu">
          <button class="primary" data-action="start">PLAY <small>${level.id} ${level.name}</small></button>
          <button data-action="shop">NEST <small>upgrades</small></button>
          <button data-action="help">HOW TO PLAY</button>
        </nav>
        ${stats ? `<p class="menu-stats">${stats}</p>` : ''}
      </div>
      ${portrait ? `<img class="menu-hero" src="${portrait}" alt="Ozo the toucan"/>` : ''}
    </div>`
  }
  function showTitle(view) {
    titleView = view; renderTitle()
    overlay.querySelector('.primary')?.focus({ preventScroll: true })
  }
  function renderHelp() {
    const row = (what, touch, keys) => `<li><b>${what}</b><span>${touch}</span><kbd>${keys}</kbd></li>`
    overlay.innerHTML = `<div class="panel help" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <h2 id="help-title">How to play</h2>
      <ul class="help-list">
        ${row('Move', 'Put your left thumb down anywhere and slide it', '← →')}
        ${row('Jump', 'Tap JUMP for a hop, hold it to go higher', 'Space')}
        ${row('Shoot', 'Hold FIRE to keep shooting', 'X')}
        ${row('Pause', 'Tap the pause button at the top', 'Esc')}
      </ul>
      <p>Break the crumbling wall and get Ozo home. Coins and research only count once you reach home, then spend them in the Nest.</p>
      <div class="actions"><button class="primary" data-action="back">GOT IT</button></div>
    </div>`
  }
  function renderCard(mode) {
    const dead = mode === 'dead', complete = mode === 'complete', paused = mode === 'paused'
    const title = complete ? 'Level complete!' : dead ? deathReason || 'Out of hearts' : 'Paused'
    const checkpoint = dead && state.checkpoint
    const text = complete ? 'Ozo made it home. Your loot is saved.' : checkpoint ? 'Start again from the flag. Loot picked up after it is lost.' : dead ? 'Back to the start. Loot from this try is lost; upgrades are kept.' : 'Loot only counts once you reach home.'
    const stats = complete ? `<p class="stats">Critters ${state.run.defeated}/${state.run.enemies} · Time ${timeLabel(state.run.seconds)} · +${state.run.research} ${currency('research')} · +${state.run.coins} ${currency('coins')}</p>` : ''
    overlay.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <h2 id="result-title">${title}</h2>${text ? `<p>${text}</p>` : ''}${stats}
      <div class="actions">${checkpoint
        ? '<button class="primary" data-action="checkpoint">FROM THE FLAG</button><button data-action="start">RESTART LEVEL</button>'
        : `<button class="primary" data-action="${paused ? 'resume' : 'start'}">${paused ? 'RESUME' : complete ? 'PLAY AGAIN' : 'TRY AGAIN'}</button>`}
      ${paused ? '<button data-action="start">RESTART</button>' : '<button data-action="shop">NEST</button>'}<button data-action="home">MENU</button></div>
    </div>`
  }
  function renderShop() {
    overlay.innerHTML = `<div class="panel shop" role="dialog" aria-modal="true" aria-labelledby="shop-title">
      <div class="shop-heading"><h2 id="shop-title">Nest</h2><span>${currency('research')} ${state.profile.research} &nbsp; ${currency('coins')} ${state.profile.coins}</span><button data-action="close-shop" aria-label="Close the nest">×</button></div>
      <ul class="shop-list">${upgrades.map(item => {
        const owned = state.profile.upgrades[item.id], enough = state.profile[item.currency] >= item.cost
        return `<li class="${owned ? 'owned' : ''}"><span><b>${item.name}</b> ${item.description}</span><button data-buy="${item.id}" ${owned || !enough ? 'disabled' : ''} aria-label="${owned ? 'Already own' : 'Buy'} ${item.name}${owned ? '' : ` for ${item.cost} ${item.currency === 'coins' ? 'gun coins' : 'research'}`}">${owned ? 'OWNED' : `${currency(item.currency)} ${item.cost}`}</button></li>`
      }).join('')}</ul>
      <p>Gun: <button data-equip="pop" class="${state.profile.equipped === 'pop' ? 'selected' : ''}" aria-pressed="${state.profile.equipped === 'pop'}">Pop Blaster</button>${state.profile.upgrades.twin ? ` <button data-equip="twin" class="${state.profile.equipped === 'twin' ? 'selected' : ''}" aria-pressed="${state.profile.equipped === 'twin'}">Twin Pop</button>` : ''}</p>
      <p class="hint">Testing: <button data-action="reset-save" class="${resetArmed > Date.now() ? 'armed' : ''}">${resetArmed > Date.now() ? 'TAP AGAIN TO RESET' : 'RESET SAVE'}</button> clears loot, upgrades and best time.</p>
    </div>`
  }
  function renderMode() {
    const mode = state.mode; stage.dataset.mode = mode
    const inLevel = ['playing', 'paused', 'dying', 'winning', 'dead', 'complete'].includes(mode)
    hud.hidden = !inLevel; progress.hidden = !inLevel; controls.hidden = mode !== 'playing'
    overlay.hidden = ['playing', 'dying', 'winning'].includes(mode)
    if (mode === 'title') { titleView = 'main'; renderTitle() }
    else if (mode === 'shop') renderShop()
    else if (['paused', 'dead', 'complete'].includes(mode)) renderCard(mode)
    if (mode === 'playing') { document.activeElement?.blur(); document.querySelector('[data-control="dash"]').hidden = !state.profile.upgrades.dash }
    else if (!overlay.hidden) overlay.querySelector('.primary, [data-action="close-shop"]')?.focus({ preventScroll: true })
  }
  overlay.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return
    unlockAudio()
    if (button.dataset.buy) { if (purchase(button.dataset.buy)) { sound('buy'); renderShop(); showToast('Yours! Ready for your next run.') }; return }
    if (button.dataset.equip) { state.profile.equipped = button.dataset.equip; saveProfile(); renderShop(); return }
    const action = button.dataset.action
    if (action === 'start') getScene().startRun()
    if (action === 'checkpoint') getScene().restartFromCheckpoint()
    if (action === 'resume') getScene().resumeRun()
    if (action === 'home') getScene().goHome()
    if (action === 'shop') { shopReturn = state.mode; setMode('shop') }
    if (action === 'close-shop') setMode(shopReturn)
    if (action === 'help') showTitle('help')
    if (action === 'back') showTitle('main')
    if (action === 'reset-save') {
      // Two taps, so it can't happen by accident.
      if (resetArmed > Date.now()) { resetArmed = 0; resetProfile(); showToast('Save reset to a fresh start.') }
      else { resetArmed = Date.now() + 5000; setTimeout(() => { if (state.mode === 'shop') renderShop() }, 5100) }
      renderShop()
    }
  })
  function updateWallet() { document.querySelector('#research-count').textContent = wallet('research'); document.querySelector('#coin-count').textContent = wallet('coins'); updateSound() }
  function showToast(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000) }
  events.addEventListener('mode', renderMode)
  events.addEventListener('ready', event => { portrait = event.detail; updateWallet(); renderMode() })
  events.addEventListener('level', event => { level = event.detail; document.querySelector('#level-name').textContent = `${level.id} ${level.name}` })
  events.addEventListener('profile', updateWallet)
  let shownHealth = PLAYER.hearts
  events.addEventListener('health', event => {
    const hearts = document.querySelector('#hearts')
    // Shake the hearts when one is lost, pop them when one comes back.
    const change = event.detail === shownHealth - 1 ? 'hurt' : event.detail === shownHealth + 1 ? 'heal' : ''
    shownHealth = event.detail
    hearts.classList.remove('hurt', 'heal'); void hearts.offsetWidth
    if (change) hearts.classList.add(change)
    hearts.innerHTML = Array.from({ length: PLAYER.hearts }, (_, i) => `<span class="${i >= event.detail ? 'empty' : ''}">♥</span>`).join(''); hearts.setAttribute('aria-label', `${event.detail} hearts remaining`)
  })
  events.addEventListener('progress', event => { document.querySelector('#progress-fill').style.width = `${event.detail * 100}%` })
  events.addEventListener('objective', event => { document.querySelector('#objective').textContent = event.detail })
  events.addEventListener('toast', event => showToast(event.detail))
  events.addEventListener('death-reason', event => { deathReason = event.detail })
  updateWallet()
}
