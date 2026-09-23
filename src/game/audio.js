import { state } from './state.js'

let context, noise
export function unlockAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)()
    if (context.state === 'suspended') context.resume().catch(() => {})
    startMusic()
  } catch { /* Audio is optional. */ }
}
// Hidden page: stop all sound. The next tap (e.g. RESUME) starts it again.
export function suspendAudio() { if (context?.state === 'running') context.suspend().catch(() => {}) }

function tone(frequency, start, duration, type, volume, end = frequency, output = context.destination) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), start + duration)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  oscillator.connect(gain).connect(output)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function note(frequency, duration, type = 'sine', volume = 0.04, delay = 0, end = frequency) {
  if (!state.profile.sound || !context || context.state !== 'running') return
  tone(frequency, context.currentTime + delay, duration, type, volume, end)
}

// `streak` raises coin pickups a whole tone per coin collected in quick succession.
export function sound(name, streak = 0) {
  if (name === 'shoot') note(650, 0.075, 'triangle', 0.025, 0, 200)
  if (name === 'jump') note(280, 0.15, 'sine', 0.055, 0, 760)
  if (name === 'coin') { const up = 2 ** (streak * 2 / 12); note(980 * up, 0.09, 'sine'); note(1320 * up, 0.14, 'sine', 0.025, 0.05) }
  if (name === 'research') { note(740, 0.1, 'sine'); note(1480, 0.2, 'sine', 0.04, 0.07) }
  if (name === 'hit') note(190, 0.18, 'triangle', 0.07, 0, 65)
  if (name === 'poof') note(350, 0.13, 'triangle', 0.05, 0, 80)
  if (name === 'pop') { note(520, 0.06, 'square', 0.03, 0, 900); note(180, 0.16, 'triangle', 0.05, 0.04, 60) }
  if (name === 'dash') note(160, 0.17, 'sine', 0.05, 0, 650)
  if (name === 'death') [330, 277, 220, 110].forEach((f, i) => note(f, 0.22, 'triangle', 0.055, i * 0.15))
  if (name === 'heal') [523, 659, 988].forEach((f, i) => note(f, 0.16, 'sine', 0.05, i * 0.07))
  if (name === 'win' || name === 'switch' || name === 'buy') [523, 659, 784, 1047].forEach((f, i) => note(f, 0.24, 'sine', 0.055, i * 0.09))
  if (name === 'star') [784, 1047, 1319].forEach((f, i) => note(f, 0.2, 'sine', 0.05, i * 0.06))
  if (name === 'key') [1319, 1568, 2093, 2637].forEach((f, i) => note(f, 0.18, 'sine', 0.045, i * 0.07))
  if (name === 'door') { note(110, 0.5, 'triangle', 0.08, 0, 70); [392, 523, 659].forEach((f, i) => note(f, 0.22, 'sine', 0.05, 0.25 + i * 0.08)) }
  if (name === 'locked') { note(220, 0.08, 'square', 0.03); note(196, 0.12, 'square', 0.03, 0.09) }
  if (name === 'tink') note(1900, 0.06, 'square', 0.02, 0, 1400)
  if (name === 'boom') { note(160, 0.35, 'triangle', 0.09, 0, 40); note(90, 0.4, 'sine', 0.08, 0.02, 35); crackle(0.3, 0.06) }
  if (name === 'shed') [900, 700, 520, 380].forEach((f, i) => note(f, 0.07, 'square', 0.02, i * 0.035))
}

// Background music: chiptune loops written out below as notes and played with
// the same simple oscillators as the sound effects. Each song is 16 bars of
// eighth notes: each bar has 8 slots; "-" holds the note before, "." rests.
// Each level picks its song in its theme.
const song = (tempo, chords, bars, lead, drums) => ({
  step: 60 / tempo / 2, // seconds per eighth note
  chords: chords.split(/\s+/),
  melody: bars.join(' ').split(/\s+/),
  lead, drums,
})
const SONGS = {
  // Canopy Coast: cheerful, in C major.
  jungle: song(112, 'C Am F G  C Am F G  F G Em Am  F G C C', [
    'E5 - G5 - C6 - G5 E5', 'A5 - G5 E5 D5 - C5 -', 'A4 - C5 - D5 - C5 D5', 'D5 - - - G4 . . .',
    'E5 - G5 - C6 - D6 -', 'E6 - D6 C6 A5 - G5 -', 'A5 - G5 E5 D5 - C5 D5', 'D5 - - - . . . .',
    'C6 - A5 - F5 - A5 -', 'B5 - G5 - D5 - G5 -', 'E5 - G5 - B5 - G5 -', 'A5 - - - E5 - C5 -',
    'A5 - G5 - F5 - E5 -', 'D5 - E5 - G5 - B5 -', 'C6 - - - G5 - E5 -', 'C5 - - - . . . .',
  ], 'square', 'full'),
  // Rainy Ridge: slower and gentler, in A minor, soft drums.
  rain: song(96, 'Am F C G  Am F G E  F G Am Am  F G Am Am', [
    'A4 - C5 - E5 - D5 C5', 'C5 - A4 - - - G4 -', 'E5 - G5 - E5 D5 C5 -', 'D5 - - - . . . .',
    'A4 - C5 - E5 - A5 -', 'G5 - E5 - D5 - C5 -', 'D5 - E5 - G5 - E5 D5', 'E5 - - - . . B4 -',
    'C5 - - - A4 - C5 -', 'D5 - - - B4 - D5 -', 'E5 - D5 C5 A4 - C5 -', 'A4 - - - . . . .',
    'A5 - G5 - E5 - C5 -', 'D5 - E5 - G5 - - -', 'E5 - D5 - C5 - B4 -', 'A4 - - - . . . .',
  ], 'triangle', 'soft'),
}
const ROOTS = { C: 48, Am: 45, F: 41, G: 43, Em: 40, E: 40 } // bass notes, as MIDI numbers
const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const frequency = midi => 440 * 2 ** ((midi - 69) / 12)
const midiOf = name => 12 * (Number(name.slice(-1)) + 1) + LETTERS[name[0]]
const MUSIC_VOLUME = { full: 0.55, quiet: 0.2 }

let musicGain, musicTimer, nextStep = 0, nextTime = 0, mood = 'full', current = SONGS.jungle

// Switches to another song (from the start of it), e.g. for a new level.
export function setMusicSong(name) {
  const next = SONGS[name] ?? SONGS.jungle
  if (next === current) return
  current = next
  nextStep = 0
}

function startMusic() {
  if (musicTimer || !context) return
  musicGain = context.createGain()
  musicGain.gain.value = MUSIC_VOLUME[mood]
  musicGain.connect(context.destination)
  nextTime = context.currentTime + 0.1
  musicTimer = setInterval(scheduleMusic, 50)
}

// Quieter while paused or after losing a life; full otherwise.
export function setMusicMood(next) {
  mood = next
  if (musicGain) musicGain.gain.setTargetAtTime(MUSIC_VOLUME[mood], context.currentTime, 0.15)
}

// Schedules the notes due in the next fraction of a second, so timing stays
// steady even if the page is busy.
function scheduleMusic() {
  if (context.state !== 'running') return
  if (nextTime < context.currentTime) nextTime = context.currentTime + 0.05 // fell behind: skip ahead
  while (nextTime < context.currentTime + 0.2) {
    if (state.profile.sound) playStep(current, nextStep, nextTime)
    nextTime += current.step
    nextStep = (nextStep + 1) % current.melody.length
  }
}

function playStep({ step: STEP, chords, melody, lead, drums }, step, time) {
  const token = melody[step]
  if (token !== '-' && token !== '.') {
    let length = 1
    while (melody[(step + length) % melody.length] === '-') length++
    tone(frequency(midiOf(token)), time, length * STEP * 0.95, lead, lead === 'square' ? 0.022 : 0.05, undefined, musicGain)
  }
  // Bouncy bass: the chord's root, jumping up an octave on every other beat.
  const beat = step % 8
  if (beat % 2 === 0) tone(frequency(ROOTS[chords[Math.floor(step / 8)]] + (beat % 4 ? 12 : 0)), time, STEP * 1.7, 'triangle', 0.07, undefined, musicGain)
  // Drums: kick on beats 1 and 3, a snap on 2 and 4, a tick on the off-beats.
  // "Soft" drums are just a gentle kick and the ticks, like rain.
  if (beat === 0 || (beat === 4 && drums === 'full')) tone(140, time, 0.12, 'sine', drums === 'full' ? 0.09 : 0.06, 45, musicGain)
  if ((beat === 2 || beat === 6) && drums === 'full') hiss(time, 0.09, 0.03, 1800)
  if (beat % 2) hiss(time, 0.03, drums === 'full' ? 0.012 : 0.009, 7000)
}

// A burst of noise as a sound effect (explosions).
function crackle(duration, volume) {
  if (!state.profile.sound || !context || context.state !== 'running') return
  hiss(context.currentTime, duration, volume, 300, context.destination)
}

// Filtered noise: the music's drums, or (with `output`) sound effects.
function hiss(time, duration, volume, cutoff, output = musicGain) {
  if (!noise) {
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain()
  source.buffer = noise
  filter.type = 'highpass'; filter.frequency.value = cutoff
  gain.gain.setValueAtTime(volume, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
  source.connect(filter).connect(gain).connect(output)
  source.start(time, Math.random() * 0.5)
  source.stop(time + duration + 0.02)
}
