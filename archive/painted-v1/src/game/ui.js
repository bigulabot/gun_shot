import { events, state, upgrades, purchase, saveProfile, setMode, resetInput } from './state.js'
import { sound, unlockAudio } from './audio.js'

const paths = {
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  jump: '<path d="M12 21V4m-7 7 7-7 7 7M5 21h14"/>',
  shoot: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  dash: '<path d="m11 4 8 8-8 8M2 8h6m-8 4h8m-6 4h6"/>', pause: '<path d="M8 5v14m8-14v14"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M3 9h4l5-5v16l-5-5H3zM17 9l5 6m0-6-5 6"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
  heart: '<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z" fill="currentColor" stroke-width="1.5"/>',
}
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.right}</svg>`
const timeLabel = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function setupUI(getScene) {
  const stage = document.querySelector('#stage'), overlay = document.querySelector('#overlay')
  const controls = document.querySelector('#controls'), hud = document.querySelector('#hud')
  const progress = document.querySelector('#level-progress'), toast = document.querySelector('#toast')
  let portrait = '', shopReturn = 'title', toastTimer
  const keyboard = new Set(), pointers = new Map()
  const buttons = [...document.querySelectorAll('[data-control]')]
  const bindings = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyX: 'shoot', KeyJ: 'shoot', ShiftLeft: 'dash', ShiftRight: 'dash' }
  function syncInput() {
    const held = new Set([...keyboard].map(key => bindings[key]).concat([...pointers.values()]))
    for (const name of ['left', 'right', 'jump', 'shoot', 'dash']) state.input[name] = state.mode === 'playing' && held.has(name)
    for (const button of buttons) button.classList.toggle('held', state.input[button.dataset.control])
  }
  for (const button of buttons) {
    const action = button.dataset.control, label = { jump: 'JUMP', shoot: 'HOLD TO SHOOT', dash: 'DASH' }[action]
    button.innerHTML = `${icon(action)}${label ? `<span>${label}</span>` : ''}`
    button.addEventListener('pointerdown', event => {
      if (state.mode !== 'playing') return
      event.preventDefault(); unlockAudio(); button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, action)
      if (action === 'jump') state.input.jumpQueued = true
      if (action === 'dash') state.input.dashQueued = true
      if (action === 'shoot') state.input.shootQueued = true
      syncInput()
    })
    const release = event => { pointers.delete(event.pointerId); syncInput() }
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, release)
    button.addEventListener('contextmenu', event => event.preventDefault())
  }
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !event.repeat) {
      if (state.mode === 'playing') getScene().pauseRun()
      else if (state.mode === 'paused') getScene().resumeRun()
      else if (state.mode === 'shop') setMode(shopReturn)
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
  events.addEventListener('release-input', () => { keyboard.clear(); pointers.clear(); syncInput() })
  const pauseWhenAway = () => { resetInput(); if (state.mode === 'playing') getScene().pauseRun() }
  window.addEventListener('blur', pauseWhenAway)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseWhenAway() })
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

  function wallet() {
    return `<div class="shop-wallet"><span><b class="crystal-symbol">◆</b> ${state.profile.research} <small>research</small></span><span><b class="coin-symbol">ϟ</b> ${state.profile.coins} <small>gun coins</small></span></div>`
  }
  function renderTitle() {
    overlay.innerHTML = `<div class="title-screen"><div class="title-copy"><div class="eyebrow"><i></i> A LITTLE BIRD. A BIG ADVENTURE.</div><h1>GUN<span>SHOT<span class="title-spark">✦</span></span></h1><p class="title-description">Big beak. Bigger adventure.<br>Run, jump and pop your way through paradise.</p><div class="title-actions"><button class="primary" data-action="start">LET’S GO ${icon('right')}</button><button class="secondary" data-action="shop">WORKSHOP <span>↗</span></button></div><div class="level-ticket"><span class="ticket-number">01</span><span><b>CANOPY COAST</b><small>Six cheeky critters. One crumbling wall. All you.</small></span><span class="ticket-leaf">❧</span></div></div><div class="hero-presentation" aria-label="Ozo, a colourful toucan holding a pop blaster"><div class="hero-halo"></div><span class="orbit orbit-one">✦</span><span class="orbit orbit-two">✦</span><span class="orbit orbit-three">◆</span><div class="hero-pedestal"></div>${portrait ? `<img class="ozo-portrait" src="${portrait}" alt="Ozo the toucan"/>` : ''}<div class="hero-name"><span>MEET YOUR HERO</span><b>OZO<span>!</span></b></div></div><div class="title-bottom"><span>${icon('left')}${icon('right')} MOVE</span><span>${icon('jump')} JUMP</span><span>${icon('shoot')} HOLD TO SHOOT</span></div></div>`
  }
  function renderCard(mode) {
    const dead = mode === 'dead', complete = mode === 'complete'
    overlay.innerHTML = `<div class="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title"><span class="eyebrow">${complete ? '01 / CANOPY COAST' : dead ? 'TAKE A BREATH, LITTLE BIRD' : 'ADVENTURE ON HOLD'}</span><div class="result-emblem ${dead ? 'broken' : ''}">${complete ? '✦' : icon(dead ? 'heart' : 'pause')}</div><h2 id="result-title">${complete ? 'Home, sweet home.' : dead ? 'One more shot?' : 'A little breather.'}</h2><p>${complete ? 'The coast is clear. Ozo made it home!' : dead ? 'Back to the start of Canopy Coast.<br>Your collected loot and upgrades are safe.' : 'Ozo will be right here when you’re ready.'}</p>${complete ? `<div class="run-stats"><span><b>${state.run.defeated}/6</b>CRITTERS</span><span><b>${timeLabel(state.run.seconds)}</b>TIME</span><span><b>+${state.run.research}</b>RESEARCH</span><span><b>+${state.run.coins}</b>COINS</span></div>` : ''}<button class="primary" data-action="${mode === 'paused' ? 'resume' : 'start'}">${mode === 'paused' ? 'KEEP GOING' : complete ? 'PLAY AGAIN' : 'TRY AGAIN'} ${icon('right')}</button><div class="result-links">${mode === 'paused' ? '<button data-action="start">Restart level</button>' : '<button data-action="shop">Visit workshop ↗</button>'}<button data-action="home">Main menu</button></div></div>`
  }
  function renderShop() {
    overlay.innerHTML = `<div class="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shop-title"><div class="shop-heading"><div><span class="eyebrow">A LITTLE UPGRADE GOES A LONG WAY</span><h2 id="shop-title">Ozo’s workshop<span>✦</span></h2></div><button class="close-button" data-action="close-shop" aria-label="Close workshop">×</button></div>${wallet()}<p class="shop-intro">Make the next run your own. Every level works with your starting skills.</p><div class="shop-grid">${upgrades.map(item => {
      const owned = state.profile.upgrades[item.id], enough = state.profile[item.currency] >= item.cost
      return `<article class="upgrade ${owned ? 'owned' : ''}"><div class="upgrade-icon ${item.currency}">${item.icon}</div><div class="upgrade-copy"><small>${item.currency === 'research' ? 'TALENT' : item.id === 'twin' ? 'NEW GUN' : 'GUN UPGRADE'}</small><h3>${item.name}</h3><p>${item.description}</p></div><button data-buy="${item.id}" ${owned || !enough ? 'disabled' : ''} aria-label="${owned ? 'Already own' : 'Buy'} ${item.name}${owned ? '' : ` for ${item.cost} ${item.currency === 'coins' ? 'gun coins' : 'research'}`}">${owned ? '✓ YOURS' : `<span class="${item.currency === 'research' ? 'crystal-symbol' : 'coin-symbol'}">${item.currency === 'research' ? '◆' : 'ϟ'}</span> ${item.cost}`}</button></article>`
    }).join('')}</div><div class="shop-footer"><div class="gun-select"><span>GUN</span><button data-equip="pop" class="${state.profile.equipped === 'pop' ? 'selected' : ''}" aria-pressed="${state.profile.equipped === 'pop'}">Pop Blaster</button>${state.profile.upgrades.twin ? `<button data-equip="twin" class="${state.profile.equipped === 'twin' ? 'selected' : ''}" aria-pressed="${state.profile.equipped === 'twin'}">Twin Pop</button>` : ''}</div><small>Saved on this device · Ready for your next run</small></div></div>`
  }
  function renderMode() {
    const mode = state.mode; stage.dataset.mode = mode
    const inLevel = ['playing', 'paused', 'dying', 'winning', 'dead', 'complete'].includes(mode)
    hud.hidden = !inLevel; progress.hidden = !inLevel; controls.hidden = mode !== 'playing'
    overlay.hidden = ['playing', 'dying', 'winning'].includes(mode)
    overlay.classList.toggle('title-overlay', mode === 'title')
    if (mode === 'title') renderTitle()
    else if (mode === 'shop') renderShop()
    else if (['paused', 'dead', 'complete'].includes(mode)) renderCard(mode)
    if (mode === 'playing') { document.activeElement?.blur(); document.querySelector('[data-control="dash"]').hidden = !state.profile.upgrades.dash }
    else if (!overlay.hidden) overlay.querySelector('.primary, .close-button')?.focus({ preventScroll: true })
  }
  overlay.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return
    unlockAudio()
    if (button.dataset.buy) { if (purchase(button.dataset.buy)) { sound('buy'); renderShop(); showToast('Yours! Ready for your next run.') }; return }
    if (button.dataset.equip) { state.profile.equipped = button.dataset.equip; saveProfile(); renderShop(); return }
    const action = button.dataset.action
    if (action === 'start') getScene().startRun()
    if (action === 'resume') getScene().resumeRun()
    if (action === 'home') getScene().goHome()
    if (action === 'shop') { shopReturn = state.mode; setMode('shop') }
    if (action === 'close-shop') setMode(shopReturn)
  })
  function updateWallet() { document.querySelector('#research-count').textContent = state.profile.research; document.querySelector('#coin-count').textContent = state.profile.coins; updateSound() }
  function showToast(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000) }
  events.addEventListener('mode', renderMode)
  events.addEventListener('ready', event => { portrait = event.detail; updateWallet(); renderMode() })
  events.addEventListener('profile', updateWallet)
  events.addEventListener('health', event => {
    const hearts = document.querySelector('#hearts'); hearts.innerHTML = [1, 2, 3].map(i => `<span class="${i > event.detail ? 'empty' : ''}">${icon('heart')}</span>`).join(''); hearts.setAttribute('aria-label', `${event.detail} hearts remaining`)
  })
  events.addEventListener('progress', event => { document.querySelector('#progress-fill').style.width = `${event.detail * 100}%` })
  events.addEventListener('objective', event => { document.querySelector('#objective').textContent = event.detail })
  events.addEventListener('toast', event => showToast(event.detail))
  updateWallet()
}
