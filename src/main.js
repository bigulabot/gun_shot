import Phaser from 'phaser'
import './style.css'
import { LevelScene } from './scenes/LevelScene.js'
import { setupUI } from './game/ui.js'
import { WORLD } from './game/tuning.js'

const params = new URLSearchParams(location.search)

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#9ad8f0',
  pixelArt: true, // crisp, unblurred pixels when sprites are scaled up
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: WORLD.gravity },
      // Fixed steps make jumps identical at any frame rate. Projectile sweeps
      // run after every step, so fast shots still can't pass through things.
      fixedStep: true,
      fps: WORLD.physicsFps,
      // In the dev server, add ?debug=1 to the URL to see collision boxes.
      debug: import.meta.env.DEV && params.has('debug'),
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LevelScene],
})

setupUI(() => game.scene.getScene('LevelScene'))

if (import.meta.env.DEV) {
  // Handy while tuning: type `game` in the browser console.
  window.game = game
  // Gameplay checks at /?verify=1. Excluded from the production build.
  if (params.has('verify')) import('./game/verify.js').then(({ setupVerification }) => setupVerification(game))
}
