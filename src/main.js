import Phaser from 'phaser'
import './style.css'
import { StarterScene } from './scenes/StarterScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#a7e9f4',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [StarterScene],
})
