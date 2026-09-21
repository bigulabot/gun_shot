import Phaser from 'phaser'

export class StarterScene extends Phaser.Scene {
  constructor() {
    super('StarterScene')
  }

  create() {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    this.add.text(centerX, 95, "Finlay's Game", {
      fontFamily: 'Arial, sans-serif',
      fontSize: '54px',
      fontStyle: 'bold',
      color: '#244265',
    }).setOrigin(0.5)

    this.add.text(centerX, 158, 'Tap the circle to try the game setup!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      color: '#244265',
    }).setOrigin(0.5)

    let taps = 0
    const score = this.add.text(centerX, 470, 'Taps: 0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#244265',
    }).setOrigin(0.5)

    const circle = this.add.circle(centerX, centerY + 45, 80, 0xffb84d)
      .setStrokeStyle(8, 0xffffff)
      .setInteractive({ useHandCursor: true })

    circle.on('pointerdown', () => {
      taps += 1
      score.setText(`Taps: ${taps}`)
      circle.setFillStyle(Phaser.Display.Color.RandomRGB(100, 255).color)
      this.tweens.add({
        targets: circle,
        scale: 1.12,
        duration: 100,
        yoyo: true,
      })
    })
  }
}
