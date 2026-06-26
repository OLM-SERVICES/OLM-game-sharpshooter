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
  private crosshairContainer!: Phaser.GameObjects.Container
  private bullseye!: Phaser.GameObjects.Graphics
  private dartboardCX!: number
  private dartboardCY!: number

  private lowGfx!: Phaser.GameObjects.Graphics
  private highGfx!: Phaser.GameObjects.Graphics
  private lowText!: Phaser.GameObjects.Text
  private highText!: Phaser.GameObjects.Text
  private lowSub!: Phaser.GameObjects.Text
  private highSub!: Phaser.GameObjects.Text

  // Aurora background graphics
  private aurora1!: Phaser.GameObjects.Graphics
  private aurora2!: Phaser.GameObjects.Graphics
  private auroraTime: number = 0

  // Spotlight
  private spotlight!: Phaser.GameObjects.Graphics

  // Glitch title
  private titleMain!: Phaser.GameObjects.Text
  private titleGlitch1!: Phaser.GameObjects.Text
  private titleGlitch2!: Phaser.GameObjects.Text
  private glitchTimer: number = 0

  public currentPick: 'HIGH' | 'LOW' | null = null
  public currentStake: number = 500
  public currentBalance: number = 0

  private PARENT_ORIGIN: string = '*'
  private btnW: number = 0
  private btnGap: number = 0
  private btnY: number = 0
  private cx: number = 0

  constructor() {
    super('GameScene')
  }

  preload() {}

  create() {
    this.PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
    this.bridge = new CasinoBridge(this.PARENT_ORIGIN)

    this.bridge.onInit((balance: number) => {
      this.isAuthenticated = true
      this.currentBalance = balance
      window.parent.postMessage(
        { type: 'BALANCE_UPDATE', payload: { balance } },
        this.PARENT_ORIGIN
      )
    })

    this.bridge.onResult((result) => {
      this.handleResult(result)
    })

    this.bridge.onErr((message) => {
      this.showError(message)
      this.isPlacing = false
      window.parent.postMessage(
        { type: 'BET_DONE', payload: {} },
        this.PARENT_ORIGIN
      )
    })

    window.addEventListener('message', (event) => {
      if (this.PARENT_ORIGIN !== '*' && event.origin !== this.PARENT_ORIGIN) return
      const { type, payload } = event.data || {}
      if (type === 'PLACE_BET') {
        this.currentStake = payload.stake
        this.currentPick = payload.pick
        this.highlightPick(payload.pick)
        this.placeBet()
      }
    })

    this.setupUI()
  }

  private setupUI() {
    const W = this.scale.width
    const H = this.scale.height
    this.cx = W / 2

    this.dartboardCX = this.cx
    this.dartboardCY = H * 0.40

    this.cameras.main.setBackgroundColor('#05001A')

    // Aurora background (Reactbits Aurora effect in Phaser)
    this.aurora1 = this.add.graphics()
    this.aurora2 = this.add.graphics()
    this.drawAurora(W, H)

    // Grid on top of aurora
    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    // Spotlight behind dartboard (Reactbits Spotlight effect)
    this.spotlight = this.add.graphics()
    this.drawSpotlight(this.cx, this.dartboardCY, W)

    // Glitch title (Reactbits GlitchText effect)
    this.createGlitchTitle(this.cx, 28)

    this.add.text(this.cx, 58, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: '10px', color: '#00F0FF'
    }).setOrigin(0.5)

    // Dartboard
    this.createDartboard(this.cx, this.dartboardCY)

    // Multiplier
    this.add.text(this.cx, this.dartboardCY + 112, '1.80×', {
      fontSize: '20px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5)
    this.add.text(this.cx, this.dartboardCY + 135, 'payout multiplier', {
      fontSize: '10px', color: '#444444'
    }).setOrigin(0.5)

    // Pick buttons
    this.createPickButtons(W, H)

    // Overlays
    this.overlay = this.add.graphics().setVisible(false).setDepth(10)
    this.overlayText = this.add.text(this.cx, H / 2 - 40, '', {
      fontSize: '56px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5).setVisible(false).setDepth(11)
    this.overlaySubText = this.add.text(this.cx, H / 2 + 24, '', {
      fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false).setDepth(11)

    this.scale.on('resize', () => { this.scene.restart() })
  }

  // ── Aurora background (animated blobs like Reactbits Aurora) ──────────────
  private drawAurora(W: number, H: number) {
    // Blob 1 — cyan/blue
    this.aurora1.clear()
    this.aurora1.fillStyle(0x00F0FF, 0.04)
    this.aurora1.fillEllipse(W * 0.25, H * 0.3, W * 0.8, H * 0.5)

    // Blob 2 — purple
    this.aurora2.clear()
    this.aurora2.fillStyle(0x4B00FF, 0.05)
    this.aurora2.fillEllipse(W * 0.75, H * 0.5, W * 0.7, H * 0.4)
  }

  // ── Spotlight beam behind dartboard (Reactbits Spotlight) ─────────────────
  private drawSpotlight(cx: number, cy: number, W: number) {
    this.spotlight.clear()
    // Radial glow — multiple circles fading outward
    const colors = [
      { r: 20,  alpha: 0.25, color: 0x00F0FF },
      { r: 50,  alpha: 0.12, color: 0x4B6EF5 },
      { r: 90,  alpha: 0.07, color: 0x00F0FF },
      { r: 140, alpha: 0.04, color: 0x4B00FF },
      { r: 200, alpha: 0.02, color: 0x4B00FF },
    ]
    colors.forEach(({ r, alpha, color }) => {
      this.spotlight.fillStyle(color, alpha)
      this.spotlight.fillCircle(cx, cy, r)
    })
  }

  // ── Glitch title (Reactbits GlitchText) ───────────────────────────────────
  private createGlitchTitle(cx: number, y: number) {
    const style = { fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: '#00F0FF', strokeThickness: 1 }

    // Glitch layers (offset clones)
    this.titleGlitch1 = this.add.text(cx - 2, y, 'SHARP SHOOTER', {
      ...style, color: '#FF3A2D', stroke: '#FF3A2D', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)

    this.titleGlitch2 = this.add.text(cx + 2, y, 'SHARP SHOOTER', {
      ...style, color: '#00F0FF', stroke: '#00F0FF', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)

    // Main title on top
    this.titleMain = this.add.text(cx, y, 'SHARP SHOOTER', style)
      .setOrigin(0.5).setDepth(2)
  }

  // ── Pick buttons ──────────────────────────────────────────────────────────
  private createPickButtons(W: number, H: number) {
    this.btnW = Math.floor(W * 0.40)
    this.btnGap = Math.floor(W * 0.05)
    this.btnY = H * 0.775

    const leftX = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2

    this.lowGfx = this.add.graphics()
    this.drawPickBtn(this.lowGfx, leftX, this.btnY, this.btnW, 64, false, 'LOW')
    this.lowText = this.add.text(leftX, this.btnY - 10, 'LOW', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.lowSub = this.add.text(leftX, this.btnY + 13, '1 - 5', {
      fontSize: '12px', color: '#4B6EF5'
    }).setOrigin(0.5)
    const lowHit = this.add.rectangle(leftX, this.btnY, this.btnW, 64)
      .setInteractive({ useHandCursor: true })
    lowHit.on('pointerdown', () => {
      this.currentPick = 'LOW'
      this.highlightPick('LOW')
      window.parent.postMessage({ type: 'PICK_SELECTED', payload: { pick: 'LOW' } }, this.PARENT_ORIGIN)
    })

    this.highGfx = this.add.graphics()
    this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, 64, false, 'HIGH')
    this.highText = this.add.text(rightX, this.btnY - 10, 'HIGH', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.highSub = this.add.text(rightX, this.btnY + 13, '6 - 10', {
      fontSize: '12px', color: '#FF3A2D'
    }).setOrigin(0.5)
    const highHit = this.add.rectangle(rightX, this.btnY, this.btnW, 64)
      .setInteractive({ useHandCursor: true })
    highHit.on('pointerdown', () => {
      this.currentPick = 'HIGH'
      this.highlightPick('HIGH')
      window.parent.postMessage({ type: 'PICK_SELECTED', payload: { pick: 'HIGH' } }, this.PARENT_ORIGIN)
    })
  }

  private drawPickBtn(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    selected: boolean, side: 'LOW' | 'HIGH'
  ) {
    g.clear()
    const borderColor = side === 'LOW' ? 0x4B6EF5 : 0xFF3A2D
    const fillColor = selected
      ? (side === 'LOW' ? 0x1a1060 : 0x3d0a0a)
      : (side === 'LOW' ? 0x0D0A2E : 0x2E0A0A)
    const borderWidth = selected ? 3 : 2
    const borderAlpha = selected ? 1 : 0.6

    g.fillStyle(fillColor, 1)
    g.lineStyle(borderWidth, borderColor, borderAlpha)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 12)
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12)

    if (selected) {
      g.fillStyle(borderColor, 0.08)
      g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 9)
      // Glow line at top of selected button
      g.lineStyle(1, borderColor, 0.6)
      g.lineBetween(x - w / 2 + 12, y - h / 2 + 2, x + w / 2 - 12, y - h / 2 + 2)
    }
  }

  private highlightPick(pick: 'HIGH' | 'LOW') {
    const leftX = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2
    this.drawPickBtn(this.lowGfx, leftX, this.btnY, this.btnW, 64, pick === 'LOW', 'LOW')
    this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, 64, pick === 'HIGH', 'HIGH')
    this.lowText.setColor(pick === 'LOW' ? '#4B6EF5' : '#ffffff')
    this.highText.setColor(pick === 'HIGH' ? '#FF3A2D' : '#ffffff')
    this.lowSub.setColor(pick === 'LOW' ? '#ffffff' : '#4B6EF5')
    this.highSub.setColor(pick === 'HIGH' ? '#ffffff' : '#FF3A2D')
  }

  private drawGrid(W: number, H: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x0A0530, 0.2)
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
      fontSize: '34px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(2)
  }

  public placeBet() {
    if (!this.currentPick || this.isPlacing || !this.isAuthenticated) return
    if (this.currentBalance < this.currentStake) {
      this.showError('Insufficient balance')
      return
    }
    this.isPlacing = true
    const clientSeed = Math.random().toString(36).substring(2)
    this.bridge.placeBet({
      game: 'SHARP_SHOOTER',
      stake: this.currentStake,
      gameParams: { pick: this.currentPick },
      clientSeed
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
          if (result.win) {
            this.numberDisplay.setColor('#00E676')
            this.bullseye.clear()
            this.bullseye.fillStyle(0x00E676, 1)
            this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)
            this.tweens.add({ targets: this.numberDisplay, scale: 1.4, duration: 150, yoyo: true })
            // Redraw spotlight in green on win
            this.spotlight.clear()
            const winColors = [
              { r: 20,  alpha: 0.30, color: 0x00E676 },
              { r: 60,  alpha: 0.15, color: 0x00E676 },
              { r: 120, alpha: 0.07, color: 0x00E676 },
            ]
            winColors.forEach(({ r, alpha, color }) => {
              this.spotlight.fillStyle(color, alpha)
              this.spotlight.fillCircle(this.dartboardCX, this.dartboardCY, r)
            })
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
    this.overlay.fillStyle(result.win ? 0x001a00 : 0x1a0000, 0.92)
    this.overlay.fillRect(0, 0, W, H)
    this.overlay.setVisible(true)

    this.overlayText
      .setText(result.win ? '🎯 WIN!' : 'MISS')
      .setColor(result.win ? '#FFD700' : '#FF3A2D')
      .setVisible(true)
      .setScale(0.5)

    // Reactbits-style scale-in animation
    this.tweens.add({
      targets: this.overlayText,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })

    this.overlaySubText
      .setText(result.win ? '₦' + result.payout.toLocaleString() : 'Better luck next time')
      .setVisible(true)
      .setAlpha(0)

    this.tweens.add({
      targets: this.overlaySubText,
      alpha: 1,
      duration: 400,
      delay: 200,
    })

    if (result.win) {
      // Burst particles from center (Reactbits Particles effect)
      for (let i = 0; i < 28; i++) {
        const p = this.add.graphics().setDepth(12)
        const colors = [0xFFD700, 0x00F0FF, 0x00E676, 0xFFFFFF, 0xFF3A2D]
        p.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1)
        const size = 2 + Math.random() * 4
        p.fillCircle(0, 0, size)
        p.setPosition(cx, this.dartboardCY)
        const angle = Math.random() * Math.PI * 2
        const dist = 60 + Math.random() * 180
        this.tweens.add({
          targets: p,
          x: cx + Math.cos(angle) * dist,
          y: this.dartboardCY + Math.sin(angle) * dist,
          alpha: 0,
          scale: 0.2,
          duration: 800 + Math.random() * 500,
          ease: 'Power2',
          onComplete: () => p.destroy()
        })
      }
    }

    this.time.delayedCall(result.win ? 2600 : 2000, () => {
      // Fade out overlay
      this.tweens.add({
        targets: [this.overlay, this.overlayText, this.overlaySubText],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.overlay.setVisible(false).setAlpha(1)
          this.overlayText.setVisible(false).setAlpha(1)
          this.overlaySubText.setVisible(false).setAlpha(1)
          this.numberDisplay.setText('?').setColor('#ffffff').setScale(1)
          this.bullseye.clear()
          this.bullseye.fillStyle(0xFF3A2D, 1)
          this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)
          // Reset spotlight
          this.drawSpotlight(this.dartboardCX, this.dartboardCY, this.scale.width)
          this.isPlacing = false
          this.currentPick = null
          const leftX = this.cx - this.btnGap - this.btnW / 2
          const rightX = this.cx + this.btnGap + this.btnW / 2
          this.drawPickBtn(this.lowGfx, leftX, this.btnY, this.btnW, 64, false, 'LOW')
          this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, 64, false, 'HIGH')
          this.lowText.setColor('#ffffff')
          this.highText.setColor('#ffffff')
          this.lowSub.setColor('#4B6EF5')
          this.highSub.setColor('#FF3A2D')
          window.parent.postMessage({
            type: 'BET_DONE',
            payload: { newBalance: this.currentBalance }
          }, this.PARENT_ORIGIN)
        }
      })
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

  update(time: number, delta: number) {
    // Rotating crosshair
    if (this.crosshairContainer) {
      this.crosshairContainer.rotation += 0.003
    }

    // Animated aurora blobs (slow drift like Reactbits Aurora)
    this.auroraTime += delta * 0.0004
    const W = this.scale.width
    const H = this.scale.height
    this.aurora1.clear()
    this.aurora1.fillStyle(0x00F0FF, 0.035)
    this.aurora1.fillEllipse(
      W * 0.25 + Math.sin(this.auroraTime) * 40,
      H * 0.3 + Math.cos(this.auroraTime * 0.7) * 30,
      W * 0.8, H * 0.5
    )
    this.aurora2.clear()
    this.aurora2.fillStyle(0x4B00FF, 0.045)
    this.aurora2.fillEllipse(
      W * 0.75 + Math.cos(this.auroraTime * 0.8) * 35,
      H * 0.55 + Math.sin(this.auroraTime * 0.6) * 25,
      W * 0.7, H * 0.4
    )

    // Glitch effect on title (fires randomly)
    this.glitchTimer += delta
    if (this.glitchTimer > 3000 + Math.random() * 4000) {
      this.glitchTimer = 0
      this.triggerGlitch()
    }
  }

  private triggerGlitch() {
    // Flash red and cyan offset copies briefly
    this.titleGlitch1.setAlpha(0.7).setX(this.cx - 3)
    this.titleGlitch2.setAlpha(0.7).setX(this.cx + 3)
    this.time.delayedCall(60, () => {
      this.titleGlitch1.setX(this.cx + 2)
      this.titleGlitch2.setX(this.cx - 2)
    })
    this.time.delayedCall(120, () => {
      this.titleGlitch1.setAlpha(0)
      this.titleGlitch2.setAlpha(0)
    })
  }
}