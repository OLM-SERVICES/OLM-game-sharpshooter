import { CasinoBridge } from '../bridge'
import type { BetResult } from '../bridge'

export class GameScene extends Phaser.Scene {
  private selectedPick: 'HIGH' | 'LOW' | null = null
  private currentStake: number = 500
  private isPlacing: boolean = false
  private balance: number = 0
  private isAuthenticated: boolean = false
  private bridge!: CasinoBridge

  private lowBtn!: Phaser.GameObjects.Graphics
  private highBtn!: Phaser.GameObjects.Graphics
  private lowBtnHit!: Phaser.GameObjects.Rectangle
  private highBtnHit!: Phaser.GameObjects.Rectangle
  private lowBtnText!: Phaser.GameObjects.Text
  private lowBtnSub!: Phaser.GameObjects.Text
  private highBtnText!: Phaser.GameObjects.Text
  private highBtnSub!: Phaser.GameObjects.Text
  private numberDisplay!: Phaser.GameObjects.Text
  private playBtn!: Phaser.GameObjects.Graphics
  private playBtnHit!: Phaser.GameObjects.Rectangle
  private playBtnText!: Phaser.GameObjects.Text
  private balanceText!: Phaser.GameObjects.Text
  private stakeTexts!: Phaser.GameObjects.Text[]
  private stakeRects!: Phaser.GameObjects.Graphics[]
  private stakeHits!: Phaser.GameObjects.Rectangle[]
  private overlay!: Phaser.GameObjects.Graphics
  private overlayText!: Phaser.GameObjects.Text
  private overlaySubText!: Phaser.GameObjects.Text
  private dartSprite!: Phaser.GameObjects.Graphics
  private crosshairContainer!: Phaser.GameObjects.Container
  private bullseye!: Phaser.GameObjects.Graphics
  private dartboardCX!: number
  private dartboardCY!: number
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super('GameScene')
  }

  preload() {
    // Custom animations will be created programmatically
  }

  create() {
    const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
    this.bridge = new CasinoBridge(PARENT_ORIGIN)

    this.bridge.onInit((balance: number) => {
      this.isAuthenticated = true
      this.balance = balance
      this.balanceText.setText('₦' + balance.toLocaleString())
      this.enableUI()
    })

    this.bridge.onResult((result) => {
      this.handleResult(result)
    })

    this.bridge.onErr((message) => {
      this.showError(message)
      this.isPlacing = false
      this.updatePlayButton()
    })

    this.setupUI()
  }

  private setupUI() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2

    this.dartboardCX = cx
    this.dartboardCY = H * 0.34

    this.cameras.main.setBackgroundColor('#05001A')
    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    // Header
    this.add.text(cx, 36, 'SHARP SHOOTER', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#00F0FF', strokeThickness: 1
    }).setOrigin(0.5)

    this.add.text(cx, 62, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: '10px', color: '#00F0FF'
    }).setOrigin(0.5)

    // Balance
    this.balanceText = this.add.text(W - 16, 12, '₦0', {
      fontSize: '13px', color: '#aaaaaa'
    }).setOrigin(1, 0)

    // Dartboard
    this.createDartboard(cx, this.dartboardCY)

    // Multiplier
    this.add.text(cx, H * 0.50, '1.80×', {
      fontSize: '20px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5)
    this.add.text(cx, H * 0.50 + 22, 'payout multiplier', {
      fontSize: '10px', color: '#555555'
    }).setOrigin(0.5)

    // Buttons
    const btnY = H * 0.63
    const btnW = Math.min(W * 0.36, 140)
    const btnH = 72
    const gap = W * 0.12

    this.lowBtn = this.add.graphics()
    this.drawBtn(this.lowBtn, cx - gap - btnW / 2, btnY, btnW, btnH, '#0D0A2E', '#4B6EF5', 2)
    this.lowBtnHit = this.add.rectangle(cx - gap - btnW / 2, btnY, btnW, btnH)
      .setInteractive({ useHandCursor: true })
    this.lowBtnText = this.add.text(cx - gap - btnW / 2, btnY - 12, 'LOW', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.lowBtnSub = this.add.text(cx - gap - btnW / 2, btnY + 14, '1 - 5', {
      fontSize: '12px', color: '#4B6EF5'
    }).setOrigin(0.5)

    this.highBtn = this.add.graphics()
    this.drawBtn(this.highBtn, cx + gap + btnW / 2, btnY, btnW, btnH, '#2E0A0A', '#FF3A2D', 2)
    this.highBtnHit = this.add.rectangle(cx + gap + btnW / 2, btnY, btnW, btnH)
      .setInteractive({ useHandCursor: true })
    this.highBtnText = this.add.text(cx + gap + btnW / 2, btnY - 12, 'HIGH', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.highBtnSub = this.add.text(cx + gap + btnW / 2, btnY + 14, '6 - 10', {
      fontSize: '12px', color: '#FF3A2D'
    }).setOrigin(0.5)

    // Stake selector
    const stakes = [100, 500, 1000, 5000]
    this.stakeRects = []
    this.stakeTexts = []
    this.stakeHits = []
    const stakeW = Math.min((W - 48) / 4 - 8, 80)
    const stakeStartX = cx - (stakeW * 1.5 + 12)
    stakes.forEach((amount, i) => {
      const x = stakeStartX + i * (stakeW + 8)
      const y = H * 0.775
      const rect = this.add.graphics()
      this.drawPill(rect, x, y, stakeW, 34, '#0D0A2E', '#2a2060', 1)
      const hit = this.add.rectangle(x, y, stakeW, 34).setInteractive({ useHandCursor: true })
      const txt = this.add.text(x, y, '₦' + (amount >= 1000 ? amount / 1000 + 'k' : amount), {
        fontSize: '12px', color: '#666666'
      }).setOrigin(0.5)
      hit.on('pointerdown', () => {
        this.currentStake = amount
        this.updateStakeUI()
      })
      this.stakeRects.push(rect)
      this.stakeTexts.push(txt)
      this.stakeHits.push(hit)
    })

    // Play button
    const playW = W - 48
    const playY = H * 0.875
    this.playBtn = this.add.graphics()
    this.drawRoundedRect(this.playBtn, cx, playY, playW, 52, 14, '#1a1a2e', '#333333', 1)
    this.playBtnHit = this.add.rectangle(cx, playY, playW, 52).setInteractive({ useHandCursor: true })
    this.playBtnText = this.add.text(cx, playY, 'Select HIGH or LOW', {
      fontSize: '15px', fontStyle: 'bold', color: '#444444'
    }).setOrigin(0.5)

    // Overlay
    this.overlay = this.add.graphics().setVisible(false).setDepth(10)
    this.overlayText = this.add.text(cx, H / 2 - 50, '', {
      fontSize: '56px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5).setVisible(false).setDepth(11)
    this.overlaySubText = this.add.text(cx, H / 2 + 20, '', {
      fontSize: '22px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false).setDepth(11)

    // Custom dart graphic (triangle shape with tail)
    this.dartSprite = this.add.graphics()
      .fillStyle(0xFF3A2D, 1)
      .fillTriangle(-8, -40, 8, -40, 0, -60)  // Dart head
      .fillStyle(0x00F0FF, 1)
      .fillRect(-2, -40, 4, 30)  // Dart tail
      .setPosition(cx, -60)
      .setVisible(false)
      .setDepth(6)
      .setAngle(180)

    // Custom particle emitter (more vibrant confetti)
    this.particles = this.add.particles(0, 0, undefined, {
      speed: { min: 150, max: 350 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1200,
      quantity: 50,
      emitting: false,
      blendMode: 'SCREEN',
      tint: [
        0xFF0000, 0x00FF00, 0x0000FF, 
        0xFFFF00, 0xFF00FF, 0x00FFFF,
        0xFFD700, 0x4B6EF5, 0xFF3A2D
      ],
      rotate: { start: 0, end: 360 },
      gravityY: 200
    }).setDepth(12)

    // Events
    this.lowBtnHit.on('pointerdown', () => this.selectPick('LOW'))
    this.highBtnHit.on('pointerdown', () => this.selectPick('HIGH'))
    this.playBtnHit.on('pointerdown', () => this.handlePlay())
    this.scale.on('resize', () => { this.scene.restart() })

    this.updateStakeUI()
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
      { r: 92, color: 0x1a0a4a, w: 3, a: 1, fill: false },
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

  private drawBtn(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: string, border: string, bw: number) {
    g.clear()
    g.fillStyle(parseInt(fill.replace('#', ''), 16), 1)
    g.lineStyle(bw, parseInt(border.replace('#', ''), 16), 1)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10)
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10)
  }

  private drawPill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: string, border: string, bw: number) {
    g.clear()
    g.fillStyle(parseInt(fill.replace('#', ''), 16), 1)
    g.lineStyle(bw, parseInt(border.replace('#', ''), 16), 1)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2)
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2)
  }

  private drawRoundedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, fill: string, border: string, bw: number) {
    g.clear()
    g.fillStyle(parseInt(fill.replace('#', ''), 16), 1)
    g.lineStyle(bw, parseInt(border.replace('#', ''), 16), 1)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r)
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r)
  }

  private enableUI() {
    this.updatePlayButton()
  }

  private handlePlay() {
    if (!this.selectedPick || this.isPlacing || !this.isAuthenticated) return
    if (this.balance < this.currentStake) {
      this.showError('Insufficient balance')
      return
    }
    this.isPlacing = true
    this.updatePlayButton()
    this.animateDartThrow()
    const clientSeed = Math.random().toString(36).substring(2)
    this.bridge.placeBet({
      game: 'SHARP_SHOOTER',
      stake: this.currentStake,
      gameParams: { pick: this.selectedPick },
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
    this.balance = result.newBalance
    this.balanceText.setText('₦' + this.balance.toLocaleString())

    let count = 0
    this.time.addEvent({
      delay: 75,
      repeat: 14,
      callback: () => {
        this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
        count++
        if (count >= 14) {
          this.numberDisplay.setText(String(roll))

          // Fly dart away
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
      // Burst confetti from bullseye center
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
      this.selectedPick = null
      this.isPlacing = false
      this.redrawButtons()
      this.updatePlayButton()
    })
  }

  private redrawButtons() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const btnY = H * 0.63
    const btnW = Math.min(W * 0.36, 140)
    const gap = W * 0.12
    this.drawBtn(this.lowBtn, cx - gap - btnW / 2, btnY, btnW, 72, '#0D0A2E', '#4B6EF5', 2)
    this.drawBtn(this.highBtn, cx + gap + btnW / 2, btnY, btnW, 72, '#2E0A0A', '#FF3A2D', 2)
    this.lowBtnText.setColor('#ffffff')
    this.highBtnText.setColor('#ffffff')
    this.lowBtnSub.setColor('#4B6EF5')
    this.highBtnSub.setColor('#FF3A2D')
  }

  private showError(message: string) {
    const cx = this.scale.width / 2
    const err = this.add.text(cx, 110, message, {
      fontSize: '13px', color: '#ff4444',
      backgroundColor: '#1a0000', padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setDepth(20)
    this.time.delayedCall(3000, () => err.destroy())
  }

  private selectPick(pick: 'HIGH' | 'LOW') {
    this.selectedPick = pick
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const btnY = H * 0.63
    const btnW = Math.min(W * 0.36, 140)
    const gap = W * 0.12
    this.drawBtn(this.lowBtn, cx - gap - btnW / 2, btnY, btnW, 72,
      pick === 'LOW' ? '#1a1060' : '#0D0A2E', '#4B6EF5', pick === 'LOW' ? 3 : 2)
    this.drawBtn(this.highBtn, cx + gap + btnW / 2, btnY, btnW, 72,
      pick === 'HIGH' ? '#3d0a0a' : '#2E0A0A', '#FF3A2D', pick === 'HIGH' ? 3 : 2)
    this.lowBtnText.setColor(pick === 'LOW' ? '#4B6EF5' : '#ffffff')
    this.highBtnText.setColor(pick === 'HIGH' ? '#FF3A2D' : '#ffffff')
    this.updatePlayButton()
  }

  private updateStakeUI() {
    const stakes = [100, 500, 1000, 5000]
    const W = this.scale.width
    const cx = W / 2
    const H = this.scale.height
    const stakeW = Math.min((W - 48) / 4 - 8, 80)
    const stakeStartX = cx - (stakeW * 1.5 + 12)
    stakes.forEach((amount, i) => {
      const x = stakeStartX + i * (stakeW + 8)
      const y = H * 0.775
      const sel = this.currentStake === amount
      this.drawPill(this.stakeRects[i], x, y, stakeW, 34,
        sel ? '#1a1060' : '#0D0A2E',
        sel ? '#4B6EF5' : '#2a2060', 1)
      this.stakeTexts[i].setColor(sel ? '#ffffff' : '#666666')
    })
    this.updatePlayButton()
  }

  private updatePlayButton() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const playW = W - 48
    const playY = H * 0.875
    if (this.selectedPick && !this.isPlacing) {
      this.drawRoundedRect(this.playBtn, cx, playY, playW, 52, 14, '#B8912A', '#FFD700', 1)
      this.playBtnText.setText('PLAY · ₦' + this.currentStake.toLocaleString()).setColor('#ffffff')
    } else if (this.isPlacing) {
      this.drawRoundedRect(this.playBtn, cx, playY, playW, 52, 14, '#2a2a2a', '#444444', 1)
      this.playBtnText.setText('Placing bet...').setColor('#aaaaaa')
    } else {
      this.drawRoundedRect(this.playBtn, cx, playY, playW, 52, 14, '#1a1a2e', '#333333', 1)
      this.playBtnText.setText('Select HIGH or LOW').setColor('#444444')
    }
  }

  update() {
    if (this.crosshairContainer) {
      this.crosshairContainer.rotation += 0.003
    }
  }
}