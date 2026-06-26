import { CasinoBridge } from '../bridge'
import type { BetResult } from '../bridge'

export class GameScene extends Phaser.Scene {
  private isPlacing: boolean = false
  private isAuthenticated: boolean = false
  private bridge!: CasinoBridge

  private numberDisplay!: Phaser.GameObjects.Text
  private overlay!: Phaser.GameObjects.Graphics
  private overlayText!: Phaser.GameObjects.Text
  private overlaySubText!: Phaser.GameObjects.Text
  private dartSprite!: Phaser.GameObjects.Image
  private crosshairContainer!: Phaser.GameObjects.Container
  private bullseye!: Phaser.GameObjects.Graphics
  private dartboardCX!: number
  private dartboardCY!: number
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter

  // Exposed for parent to call
  public currentPick: 'HIGH' | 'LOW' | null = null
  public currentStake: number = 500
  public currentBalance: number = 0

  constructor() {
    super('GameScene')
  }

  preload() {
    this.load.image('dart', '/dart.png')
    this.load.image('confetti', '/confetti.png')
  }

  create() {
    const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
    this.bridge = new CasinoBridge(PARENT_ORIGIN)

    this.bridge.onInit((balance: number) => {
      this.isAuthenticated = true
      this.currentBalance = balance
      // Notify parent of balance
      window.parent.postMessage({ type: 'BALANCE_UPDATE', payload: { balance } }, PARENT_ORIGIN)
    })

    this.bridge.onResult((result) => {
      this.handleResult(result)
    })

    this.bridge.onErr((message) => {
      this.showError(message)
      this.isPlacing = false
      // Notify parent bet is done
      window.parent.postMessage({ type: 'BET_DONE', payload: {} }, PARENT_ORIGIN)
    })

    // Listen for commands from parent
    window.addEventListener('message', (event) => {
      const { type, payload } = event.data || {}
      if (type === 'SET_PICK') {
        this.currentPick = payload.pick
        this.updatePickVisual()
      }
      if (type === 'PLACE_BET') {
        this.currentStake = payload.stake
        this.currentPick = payload.pick
        this.placeBet()
      }
    })

    this.setupUI()
  }

  private setupUI() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2

    this.dartboardCX = cx
    this.dartboardCY = H * 0.5  // centered since no controls below

    this.cameras.main.setBackgroundColor('#05001A')
    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    // Subtle title
    this.add.text(cx, 28, 'SHARP SHOOTER', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#00F0FF', strokeThickness: 1
    }).setOrigin(0.5)

    this.add.text(cx, 52, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: '9px', color: '#00F0FF'
    }).setOrigin(0.5)

    // Dartboard centered
    this.createDartboard(cx, this.dartboardCY)

    // Multiplier below dartboard
    this.add.text(cx, this.dartboardCY + 110, '1.80×', {
      fontSize: '18px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5)
    this.add.text(cx, this.dartboardCY + 132, 'payout multiplier', {
      fontSize: '9px', color: '#444444'
    }).setOrigin(0.5)

    // Pick indicator (shows selected pick)
    this.createPickIndicator(cx, this.dartboardCY + 165, W)

    // Overlay
    this.overlay = this.add.graphics().setVisible(false).setDepth(10)
    this.overlayText = this.add.text(cx, H / 2 - 40, '', {
      fontSize: '52px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5).setVisible(false).setDepth(11)
    this.overlaySubText = this.add.text(cx, H / 2 + 20, '', {
      fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false).setDepth(11)

    // Dart sprite
    this.dartSprite = this.add.image(cx, -60, 'dart')
      .setDisplaySize(28, 70)
      .setAngle(180)
      .setVisible(false)
      .setDepth(6)

    // Particles
    this.particles = this.add.particles(0, 0, 'confetti', {
      speed: { min: 100, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1000,
      quantity: 30,
      emitting: false,
    }).setDepth(12)

    this.scale.on('resize', () => { this.scene.restart() })
  }

  private createPickIndicator(cx: number, y: number, W: number) {
    const btnW = Math.min(W * 0.38, 150)
    const gap = W * 0.10

    // LOW box
    const lowGfx = this.add.graphics()
    lowGfx.lineStyle(2, 0x4B6EF5, 1)
    lowGfx.fillStyle(0x0D0A2E, 1)
    lowGfx.fillRoundedRect(cx - gap - btnW - btnW / 2, y - 28, btnW, 56, 10)
    lowGfx.strokeRoundedRect(cx - gap - btnW - btnW / 2, y - 28, btnW, 56, 10)
    this.add.text(cx - gap - btnW, y - 10, 'LOW', {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.add.text(cx - gap - btnW, y + 12, '1 - 5', {
      fontSize: '11px', color: '#4B6EF5'
    }).setOrigin(0.5)

    // HIGH box
    const highGfx = this.add.graphics()
    highGfx.lineStyle(2, 0xFF3A2D, 1)
    highGfx.fillStyle(0x2E0A0A, 1)
    highGfx.fillRoundedRect(cx + gap, y - 28, btnW, 56, 10)
    highGfx.strokeRoundedRect(cx + gap, y - 28, btnW, 56, 10)
    this.add.text(cx + gap + btnW / 2, y - 10, 'HIGH', {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.add.text(cx + gap + btnW / 2, y + 12, '6 - 10', {
      fontSize: '11px', color: '#FF3A2D'
    }).setOrigin(0.5)

    // Make them interactive for pick selection
    const lowHit = this.add.rectangle(cx - gap - btnW, y, btnW, 56)
      .setInteractive({ useHandCursor: true })
    const highHit = this.add.rectangle(cx + gap + btnW / 2, y, btnW, 56)
      .setInteractive({ useHandCursor: true })

    lowHit.on('pointerdown', () => {
      const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
      window.parent.postMessage({ type: 'PICK_SELECTED', payload: { pick: 'LOW' } }, PARENT_ORIGIN)
    })
    highHit.on('pointerdown', () => {
      const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
      window.parent.postMessage({ type: 'PICK_SELECTED', payload: { pick: 'HIGH' } }, PARENT_ORIGIN)
    })
  }

  private updatePickVisual() {
    // Visual feedback handled via overlay flash
    if (this.currentPick) {
      const color = this.currentPick === 'LOW' ? '#4B6EF5' : '#FF3A2D'
      const flash = this.add.text(
        this.scale.width / 2,
        this.dartboardCY - 120,
        `${this.currentPick} selected`,
        { fontSize: '13px', color, backgroundColor: '#000000', padding: { x: 10, y: 6 } }
      ).setOrigin(0.5).setDepth(15)
      this.time.delayedCall(800, () => flash.destroy())
    }
  }

  private drawGrid(W: number, H: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x0A0530, 0.25)
    for (let x = 0; x <= W; x += 40) { grid.moveTo(x, 0); grid.lineTo(x, H) }
    for (let y = 0; y <= H; y += 40) { grid.moveTo(0, y); grid.lineTo(W, y) }
    grid.strokePath()
  }

  private drawDecorativeDots(W: number, H: number) {
    const dots = this.add.graphics()
    const positions = [
      { x: 24, y: 24 }, { x: W - 24, y: 24 },
      { x: 24, y: H - 24 }, { x: W - 24, y: H - 24 },
      { x: W / 2, y: 24 }, { x: W / 2, y: H - 24 },
      { x: 24, y: H / 2 }, { x: W - 24, y: H / 2 }
    ]
    positions.forEach((pos, i) => {
      dots.fillStyle(i % 2 === 0 ? 0x00F0FF : 0xFFD700, 0.8)
      dots.fillRect(pos.x - 3, pos.y - 3, 6, 6)
    })
  }

  private createDartboard(cx: number, cy: number) {
    const rings = [
      { r: 92, color: 0x1a0a4a, w: 3, a: 1,   fill: false },
      { r: 72, color: 0x4B6EF5, w: 2, a: 0.5, fill: false },
      { r: 52, color: 0x00F0FF, w: 2, a: 0.7, fill: false },
      { r: 32, color: 0xFF3A2D, w: 2, a: 0.8, fill: false },
      { r: 15, color: 0xFF3A2D, w: 2, a: 1,   fill: true  },
    ]
    rings.forEach(ring => {
      const g = this.add.graphics()
      g.lineStyle(ring.w, ring.color, ring.a)
      if (ring.fill) { g.fillStyle(ring.color, 1); g.fillCircle(cx, cy, ring.r) }
      g.strokeCircle(cx, cy, ring.r)
    })

    this.crosshairContainer = this.add.container(cx, cy)
    const ch = this.add.graphics()
    ch.lineStyle(1, 0x00F0FF, 0.35)
    ch.lineBetween(-110, 0, 110, 0)
    ch.lineBetween(0, -110, 0, 110)
    ch.lineBetween(-78, -78, 78, 78)
    ch.lineBetween(78, -78, -78, 78)
    this.crosshairContainer.add(ch)

    this.bullseye = this.add.graphics()
    this.bullseye.fillStyle(0xFF3A2D, 1)
    this.bullseye.fillCircle(cx, cy, 15)

    this.numberDisplay = this.add.text(cx, cy, '?', {
      fontSize: '32px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(2)
  }

  public placeBet() {
    if (!this.currentPick || this.isPlacing || !this.isAuthenticated) return
    if (this.currentBalance < this.currentStake) {
      this.showError('Insufficient balance')
      return
    }
    this.isPlacing = true
    this.animateDartThrow()
    const clientSeed = Math.random().toString(36).substring(2)
    this.bridge.placeBet({
      game: 'SHARP_SHOOTER',
      stake: this.currentStake,
      gameParams: { pick: this.currentPick },
      clientSeed
    })
  }

  private animateDartThrow() {
    const cx = this.scale.width / 2
    this.dartSprite.setPosition(cx, -60).setVisible(true)
    this.tweens.add({
      targets: this.dartSprite,
      y: this.dartboardCY - 10,
      duration: 380,
      ease: 'Power3',
    })
  }

  private handleResult(result: BetResult) {
    const roll = (result.result as { roll: number }).roll
    this.currentBalance = result.newBalance

    let count = 0
    this.time.addEvent({
      delay: 75,
      repeat: 14,
      callback: () => {
        this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
        count++
        if (count >= 14) {
          this.numberDisplay.setText(String(roll))

          this.time.delayedCall(700, () => {
            this.tweens.add({
              targets: this.dartSprite,
              y: this.scale.height + 60,
              duration: 280,
              ease: 'Power2',
              onComplete: () => this.dartSprite.setVisible(false)
            })
          })

          if (result.win) {
            this.numberDisplay.setColor('#00E676')
            this.bullseye.clear()
            this.bullseye.fillStyle(0x00E676, 1)
            this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)
            this.tweens.add({ targets: this.numberDisplay, scale: 1.4, duration: 150, yoyo: true })
          } else {
            this.numberDisplay.setColor('#FF4444')
            this.cameras.main.shake(250, 0.006)
          }
          this.showResultOverlay(result)
        }
      }
    })
  }

  private showResultOverlay(result: BetResult) {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2

    this.overlay.clear()
    this.overlay.fillStyle(result.win ? 0x002200 : 0x1a0000, 0.9)
    this.overlay.fillRect(0, 0, W, H)
    this.overlay.setVisible(true)

    this.overlayText
      .setText(result.win ? 'WIN!' : 'MISS')
      .setColor(result.win ? '#FFD700' : '#FF3A2D')
      .setVisible(true)
    this.overlaySubText
      .setText(result.win ? '₦' + result.payout.toLocaleString() : 'Better luck next time')
      .setVisible(true)

    if (result.win) {
      this.particles.setPosition(cx, this.dartboardCY)
      this.particles.explode(40)
    }

    this.time.delayedCall(result.win ? 2500 : 2000, () => {
      this.overlay.setVisible(false)
      this.overlayText.setVisible(false)
      this.overlaySubText.setVisible(false)
      this.numberDisplay.setText('?').setColor('#ffffff').setScale(1)
      this.bullseye.clear()
      this.bullseye.fillStyle(0xFF3A2D, 1)
      this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)
      this.isPlacing = false
      this.currentPick = null

      // Notify parent bet is complete
      const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
      window.parent.postMessage({
        type: 'BET_DONE',
        payload: { newBalance: this.currentBalance }
      }, PARENT_ORIGIN)
    })
  }

  private showError(message: string) {
    const cx = this.scale.width / 2
    const err = this.add.text(cx, 80, message, {
      fontSize: '13px', color: '#ff4444',
      backgroundColor: '#1a0000', padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setDepth(20)
    this.time.delayedCall(3000, () => err.destroy())
  }

  update() {
    if (this.crosshairContainer) {
      this.crosshairContainer.rotation += 0.003
    }
  }
}