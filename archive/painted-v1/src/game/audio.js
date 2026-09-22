import { state } from './state.js'

let context
export function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)()
    if (context.state === 'suspended') context.resume().catch(() => {})
  } catch { /* Audio is optional. */ }
}

function note(frequency, duration, type = 'sine', volume = 0.04, delay = 0, end = frequency) {
  if (!state.profile.sound || !context || context.state !== 'running') return
  const start = context.currentTime + delay
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), start + duration)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function sound(name) {
  if (name === 'shoot') note(650, 0.075, 'triangle', 0.025, 0, 200)
  if (name === 'jump') note(280, 0.15, 'sine', 0.055, 0, 760)
  if (name === 'coin') { note(980, 0.09, 'sine'); note(1320, 0.14, 'sine', 0.025, 0.05) }
  if (name === 'research') { note(740, 0.1, 'sine'); note(1480, 0.2, 'sine', 0.04, 0.07) }
  if (name === 'hit') note(190, 0.18, 'triangle', 0.07, 0, 65)
  if (name === 'poof') note(350, 0.13, 'triangle', 0.05, 0, 80)
  if (name === 'dash') note(160, 0.17, 'sine', 0.05, 0, 650)
  if (name === 'death') [330, 277, 220, 110].forEach((f, i) => note(f, 0.22, 'triangle', 0.055, i * 0.15))
  if (name === 'win' || name === 'switch' || name === 'buy') [523, 659, 784, 1047].forEach((f, i) => note(f, 0.24, 'sine', 0.055, i * 0.09))
}
