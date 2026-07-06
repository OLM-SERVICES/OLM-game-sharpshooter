import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene'

const container = document.getElementById('game-container')!

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: container.clientWidth || window.innerWidth,
  height: container.clientHeight || window.innerHeight,
  backgroundColor: '#05001A',
  parent: 'game-container',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
    width: '100%',
    height: '100%',
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
  },
}

const game = new Phaser.Game(config)
game.scale.setZoom(window.devicePixelRatio || 1)