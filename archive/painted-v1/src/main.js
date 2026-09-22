import Phaser from 'phaser'
import './style.css'
import { CanopyScene } from './scenes/CanopyScene.js'
import { setupUI } from './game/ui.js'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#a8ddd0',
  render: { antialias: true, roundPixels: false },
  // Match movement to rendering, including high-refresh PC screens. Projectile
  // sweeps still catch impacts between frames when the frame rate is lower.
  physics: { default: 'arcade', arcade: { gravity: { y: 1600 }, fixedStep: false, debug: false } },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [CanopyScene],
})

setupUI(() => game.scene.getScene('CanopyScene'))

// Development-only, deterministic gameplay checks; excluded from production.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('verify')) {
  import('./game/verify.js').then(({ setupVerification }) => setupVerification(game))
}
