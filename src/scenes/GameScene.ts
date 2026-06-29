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
  private bullseyeRadius: number = 15

  private lowGfx!: Phaser.GameObjects.Graphics
  private highGfx!: Phaser.GameObjects.Graphics
  private lowText!: Phaser.GameObjects.Text
  private highText!: Phaser.GameObjects.Text
  private lowSub!: Phaser.GameObjects.Text
  private highSub!: Phaser.GameObjects.Text
  private lowHit!: Phaser.GameObjects.Rectangle
  private highHit!: Phaser.GameObjects.Rectangle

  private aurora1!: Phaser.GameObjects.Graphics
  private aurora2!: Phaser.GameObjects.Graphics
  private auroraTime: number = 0

  private spotlight!: Phaser.GameObjects.Graphics

  private titleGlitch1!: Phaser.GameObjects.Text
  private titleGlitch2!: Phaser.GameObjects.Text
  private glitchTimer: number = 0

  private rollSound!: Phaser.Sound.BaseSound
  private btnH: number = 52

  private layoutScale: number = 1

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

  preload() {
    this.load.audio('click',   '/sounds/click.wav')
    this.load.audio('select',  '/sounds/select.wav')
    this.load.audio('roll1',   '/sounds/roll1.wav')
    this.load.audio('win',     '/sounds/win.wav')
    this.load.audio('loss',    '/sounds/loss.wav')
    this.load.audio('bgmusic', '/sounds/background.mp3')
  }

  create() {
    this.sound.pauseOnBlur = false
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

    this.bridge.onResult((result) => { this.handleResult(result) })

    this.bridge.onErr((message) => {
      this.showError(message)
      this.isPlacing = false
      this.tweens.killTweensOf(this.crosshairContainer)
      this.crosshairContainer.setAlpha(1)
      if (this.rollSound?.isPlaying) this.rollSound.stop()
      window.parent.postMessage({ type: 'BET_DONE', payload: {} }, this.PARENT_ORIGIN)
    })

    window.addEventListener('message', (event) => {
      if (this.PARENT_ORIGIN !== '*' && event.origin !== this.PARENT_ORIGIN) return
      const { type, payload } = event.data || {}
      if (type === 'PLACE_BET') {
        this.currentStake = payload.stake
        this.currentPick  = payload.pick
        this.highlightPick(payload.pick)
        this.placeBet()
      }
    })

    this.time.delayedCall(300, () => {
      const ctx = (this.sound as any).context
      if (ctx) {
        ctx.resume().then(() => {
          this.sound.play('bgmusic', { loop: true, volume: 0.12 })
        }).catch(() => {
          this.sound.play('bgmusic', { loop: true, volume: 0.12 })
        })
      } else {
        this.sound.play('bgmusic', { loop: true, volume: 0.12 })
      }
    })

    this.setupUI()
  }

  private setupUI() {
    const W = this.scale.width
    const H = this.scale.height
    this.cx = W / 2

    this.cameras.main.setBackgroundColor('#05001A')

    this.aurora1 = this.add.graphics()
    this.aurora2 = this.add.graphics()
    this.drawAurora(W, H)
    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    // ── Layout strategy ────────────────────────────────────────────────
    // 4 zones, working bottom-up so buttons are guaranteed on-screen:
    //
    //   Zone D  (bottom)       — LOW / HIGH buttons — fixed pixel height
    //   Zone C  (above D)      — multiplier label   — fixed pixel height
    //   Zone B  (remaining middle) — dartboard      — fills what's left
    //   Zone A  (top)          — header              — fixed pixel height
    //
    // Working bottom-up means no matter how short the canvas is (desktop
    // iframe), the buttons are always visible.

    // Button height: proportion of canvas, clamped
    const btnHeight = Math.round(Phaser.Math.Clamp(H * 0.115, 44, 66))

    // ── Zone D: Buttons ────────────────────────────────────────────────
    // Pin to bottom with 10px margin — never pushed off canvas
    const buttonY  = Math.min(Math.round(H * 0.88), H - btnHeight / 2 - 10)

    // ── Zone C: Multiplier (just above buttons) ────────────────────────
    const multSubY = buttonY - btnHeight / 2 - 10
    const multY    = multSubY - 16

    // ── Zone A: Header (top) ───────────────────────────────────────────
    const titleY   = Math.round(H * 0.09)
    const subY     = Math.round(H * 0.16)

    // ── Zone B: Dartboard (centered in remaining space) ────────────────
    const boardTop    = subY + 12
    const boardBottom = multY - 14
    const boardCY     = Math.round((boardTop + boardBottom) / 2)

    // Ring scale: fit outer ring (92px base) into zone B
    const availableR = (boardBottom - boardTop) / 2 - 4
    // Tighter cap (1.25 max) — prevents desktop dartboard from overflowing
    const ringScale  = Phaser.Math.Clamp(availableR / 92, 0.60, 1.25)
    this.layoutScale = ringScale

    this.dartboardCX = this.cx
    this.dartboardCY = boardCY

    // Spotlight behind dartboard
    this.spotlight = this.add.graphics()
    this.drawSpotlight(this.cx, boardCY, ringScale)

    // Header
    this.createGlitchTitle(this.cx, titleY, ringScale)
    this.add.text(this.cx, subY, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: `${Math.round(10 * ringScale)}px`,
      color: '#00F0FF',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5)

    // Dartboard
    this.createDartboard(this.cx, boardCY, ringScale)

    // Multiplier
    this.add.text(this.cx, multY, '1.90×', {
      fontSize: `${Math.round(17 * ringScale)}px`,
      fontStyle: 'bold',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(3)
    this.add.text(this.cx, multSubY, 'payout multiplier', {
      fontSize: `${Math.round(9 * ringScale)}px`,
      color: '#555555',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(3)

    // Buttons
    this.createPickButtons(W, buttonY, ringScale, btnHeight)

    // Overlays
    this.overlay = this.add.graphics().setVisible(false).setDepth(10)
    this.overlayText = this.add.text(this.cx, H / 2 - 30, '', {
      fontSize: '48px', fontStyle: 'bold', color: '#FFD700', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setVisible(false).setDepth(11)
    this.overlaySubText = this.add.text(this.cx, H / 2 + 28, '', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setVisible(false).setDepth(11)

    this.scale.on('resize', () => { this.scene.restart() })
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private drawAurora(W: number, H: number) {
    this.aurora1.clear()
    this.aurora1.fillStyle(0x00F0FF, 0.04)
    this.aurora1.fillEllipse(W * 0.25, H * 0.3, W * 0.8, H * 0.5)
    this.aurora2.clear()
    this.aurora2.fillStyle(0x4B00FF, 0.05)
    this.aurora2.fillEllipse(W * 0.75, H * 0.5, W * 0.7, H * 0.4)
  }

  private drawSpotlight(cx: number, cy: number, scale: number = 1) {
    this.spotlight.clear()
    const layers = [
      { r: 20,  alpha: 0.25, color: 0x00F0FF },
      { r: 50,  alpha: 0.12, color: 0x4B6EF5 },
      { r: 90,  alpha: 0.07, color: 0x00F0FF },
      { r: 140, alpha: 0.04, color: 0x4B00FF },
      { r: 200, alpha: 0.02, color: 0x4B00FF },
    ]
    layers.forEach(({ r, alpha, color }) => {
      this.spotlight.fillStyle(color, alpha)
      this.spotlight.fillCircle(cx, cy, Math.round(r * scale))
    })
  }

  private createGlitchTitle(cx: number, y: number, scale: number) {
    const fontSize = Math.round(Phaser.Math.Clamp(20 * scale, 16, 26))
    const style = {
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#00F0FF',
      strokeThickness: 1
    }
    this.titleGlitch1 = this.add.text(cx - 2, y, 'SHARP SHOOTER', {
      ...style, color: '#FF3A2D', stroke: '#FF3A2D', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)
    this.titleGlitch2 = this.add.text(cx + 2, y, 'SHARP SHOOTER', {
      ...style, color: '#00F0FF', stroke: '#00F0FF', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)
    this.add.text(cx, y, 'SHARP SHOOTER', style).setOrigin(0.5).setDepth(2)
  }

  private createPickButtons(W: number, btnY: number, scale: number, btnHeight: number) {
    this.btnH   = btnHeight
    this.btnW   = Math.floor(Math.min(W * 0.42, 160))
    this.btnGap = Math.floor(W * 0.04)
    this.btnY   = btnY

    const leftX  = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2

    const labelSize   = Math.round(Phaser.Math.Clamp(16 * scale, 13, 20))
    const subSize     = Math.round(Phaser.Math.Clamp(11 * scale, 10, 14))
    const labelOffset = Math.round(btnHeight * 0.18)
    const subOffset   = Math.round(btnHeight * 0.22)

    // LOW
    this.lowGfx = this.add.graphics().setDepth(5)
    this.drawPickBtn(this.lowGfx, leftX, btnY, this.btnW, this.btnH, false, 'LOW')
    this.lowText = this.add.text(leftX, btnY - labelOffset, 'LOW', {
      fontSize: `${labelSize}px`, fontStyle: 'bold', color: '#ffffff', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(6)
    this.lowSub = this.add.text(leftX, btnY + subOffset, '1 - 5', {
      fontSize: `${subSize}px`, color: '#4B6EF5', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(6)
    this.lowHit = this.add.rectangle(leftX, btnY, this.btnW, this.btnH)
      .setInteractive({ useHandCursor: true }).setDepth(7)
    this.lowHit.on('pointerdown', () => {
      if (this.isPlacing) return
      this.sound.play('select', { volume: 0.5 })
      this.currentPick = 'LOW'
      this.highlightPick('LOW')
      window.parent.postMessage(
        { type: 'PICK_SELECTED', payload: { pick: 'LOW' } }, this.PARENT_ORIGIN
      )
    })

    // HIGH
    this.highGfx = this.add.graphics().setDepth(5)
    this.drawPickBtn(this.highGfx, rightX, btnY, this.btnW, this.btnH, false, 'HIGH')
    this.highText = this.add.text(rightX, btnY - labelOffset, 'HIGH', {
      fontSize: `${labelSize}px`, fontStyle: 'bold', color: '#ffffff', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(6)
    this.highSub = this.add.text(rightX, btnY + subOffset, '6 - 10', {
      fontSize: `${subSize}px`, color: '#FF3A2D', fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(6)
    this.highHit = this.add.rectangle(rightX, btnY, this.btnW, this.btnH)
      .setInteractive({ useHandCursor: true }).setDepth(7)
    this.highHit.on('pointerdown', () => {
      if (this.isPlacing) return
      this.sound.play('select', { volume: 0.5 })
      this.currentPick = 'HIGH'
      this.highlightPick('HIGH')
      window.parent.postMessage(
        { type: 'PICK_SELECTED', payload: { pick: 'HIGH' } }, this.PARENT_ORIGIN
      )
    })
  }

  private drawPickBtn(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    selected: boolean, side: 'LOW' | 'HIGH'
  ) {
    g.clear()
    const scale       = this.layoutScale || 1
    const corner      = Math.round(10 * scale)
    const borderColor = side === 'LOW' ? 0x4B6EF5 : 0xFF3A2D
    const fillColor   = selected
      ? (side === 'LOW' ? 0x1a1060 : 0x3d0a0a)
      : (side === 'LOW' ? 0x0D0A2E : 0x2E0A0A)
    const borderWidth = Math.max(1, Math.round((selected ? 3 : 2) * scale))
    const borderAlpha = selected ? 1 : 0.6
    g.fillStyle(fillColor, 1)
    g.lineStyle(borderWidth, borderColor, borderAlpha)
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, corner)
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, corner)
    if (selected) {
      const inset = Math.round(4 * scale)
      g.fillStyle(borderColor, 0.08)
      g.fillRoundedRect(x - w / 2 + inset, y - h / 2 + inset, w - inset * 2, h - inset * 2, Math.max(0, corner - 2))
      g.lineStyle(1, borderColor, 0.6)
      g.lineBetween(x - w / 2 + inset * 3, y - h / 2 + inset / 2, x + w / 2 - inset * 3, y - h / 2 + inset / 2)
    }
  }

  private highlightPick(pick: 'HIGH' | 'LOW') {
    const leftX  = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2
    this.drawPickBtn(this.lowGfx,  leftX,  this.btnY, this.btnW, this.btnH, pick === 'LOW',  'LOW')
    this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, this.btnH, pick === 'HIGH', 'HIGH')
    this.lowText.setColor(pick === 'LOW'   ? '#4B6EF5' : '#ffffff')
    this.highText.setColor(pick === 'HIGH' ? '#FF3A2D' : '#ffffff')
    this.lowSub.setColor(pick === 'LOW'    ? '#ffffff' : '#4B6EF5')
    this.highSub.setColor(pick === 'HIGH'  ? '#ffffff' : '#FF3A2D')
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

  private createDartboard(cx: number, cy: number, ringScale: number = 1) {
    const rings = [
      { r: 92, color: 0x1a0a4a, w: 3, a: 1,   fill: false },
      { r: 72, color: 0x4B6EF5, w: 2, a: 0.5, fill: false },
      { r: 52, color: 0x00F0FF, w: 2, a: 0.7, fill: false },
      { r: 32, color: 0xFF3A2D, w: 2, a: 0.8, fill: false },
      { r: 15, color: 0xFF3A2D, w: 2, a: 1,   fill: true  },
    ]
    rings.forEach(ring => {
      const r = Math.round(ring.r * ringScale)
      const g = this.add.graphics()
      g.lineStyle(ring.w, ring.color, ring.a)
      if (ring.fill) { g.fillStyle(ring.color, 1); g.fillCircle(cx, cy, r) }
      g.strokeCircle(cx, cy, r)
    })

    this.crosshairContainer = this.add.container(cx, cy)
    const ch = this.add.graphics()
    const cl = Math.round(110 * ringScale)
    const cd = Math.round(78  * ringScale)
    ch.lineStyle(1, 0x00F0FF, 0.35)
    ch.lineBetween(-cl, 0, cl, 0)
    ch.lineBetween(0, -cl, 0, cl)
    ch.lineBetween(-cd, -cd, cd, cd)
    ch.lineBetween(cd, -cd, -cd, cd)
    this.crosshairContainer.add(ch)

    this.bullseyeRadius = Math.round(15 * ringScale)

    this.bullseye = this.add.graphics()
    this.bullseye.fillStyle(0xFF3A2D, 1)
    this.bullseye.fillCircle(cx, cy, this.bullseyeRadius)

    this.numberDisplay = this.add.text(cx, cy, '?', {
      fontSize: `${Math.round(30 * ringScale)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(2)
  }

  public placeBet() {
    if (!this.currentPick || this.isPlacing || !this.isAuthenticated) return
    if (this.currentBalance < this.currentStake) {
      this.showError('Insufficient balance')
      return
    }
    this.isPlacing = true
    this.sound.play('click', { volume: 0.6 })
    this.rollSound = this.sound.add('roll1')
    this.rollSound.play({ volume: 0.3, loop: false })
    this.tweens.add({
      targets: this.crosshairContainer,
      alpha: 0.3, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    })
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
    this.tweens.killTweensOf(this.crosshairContainer)
    this.crosshairContainer.setAlpha(1)

    const delays = [120, 110, 100, 90, 80, 70, 65, 60, 60, 65, 70, 80, 90, 110, 130]
    let elapsed = 0

    delays.forEach((delay, i) => {
      this.time.delayedCall(elapsed, () => {
        if (i < delays.length - 1) {
          this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
        } else {
          if (this.rollSound?.isPlaying) this.rollSound.stop()
          this.numberDisplay.setText(String(roll))
          this.bullseye.clear()
          this.bullseye.fillStyle(0xFFFFFF, 1)
          this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, this.bullseyeRadius)
          this.time.delayedCall(100, () => {
            this.bullseye.clear()
            this.bullseye.fillStyle(result.win ? 0x00E676 : 0xFF4444, 1)
            this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, this.bullseyeRadius)
            if (result.win) {
              this.sound.play('win', { volume: 0.8 })
              this.numberDisplay.setColor('#00E676')
              this.tweens.add({ targets: this.numberDisplay, scale: 1.4, duration: 150, yoyo: true })
              this.spotlight.clear()
              ;[{ r: 20, a: 0.30 }, { r: 60, a: 0.15 }, { r: 120, a: 0.07 }].forEach(({ r, a }) => {
                this.spotlight.fillStyle(0x00E676, a)
                this.spotlight.fillCircle(this.dartboardCX, this.dartboardCY, Math.round(r * this.layoutScale))
              })
              ;[92, 72, 52, 32].forEach((r, ri) => {
                const scaledR = Math.round(r * this.layoutScale)
                const ring = this.add.graphics().setDepth(8)
                ring.lineStyle(2, 0x00E676, 0.8)
                ring.strokeCircle(this.dartboardCX, this.dartboardCY, scaledR)
                this.tweens.add({
                  targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0,
                  duration: 600, delay: ri * 80, ease: 'Power2',
                  onComplete: () => ring.destroy()
                })
              })
            } else {
              this.sound.play('loss', { volume: 0.7 })
              this.numberDisplay.setColor('#FF4444')
              this.cameras.main.shake(250, 0.006)
            }
            const flash = this.add.graphics().setDepth(20)
            flash.fillStyle(result.win ? 0x00E676 : 0xFF3A2D, 0.15)
            flash.fillRect(0, 0, this.scale.width, this.scale.height)
            this.tweens.add({ targets: flash, alpha: 0, duration: 350, onComplete: () => flash.destroy() })
            this.showResultOverlay(result)
          })
        }
      })
      elapsed += delay
    })
  }

  private showResultOverlay(result: BetResult) {
    const W  = this.scale.width
    const H  = this.scale.height
    const cx = W / 2

    this.overlay.clear()
    this.overlay.fillStyle(result.win ? 0x001a00 : 0x1a0000, 0.92)
    this.overlay.fillRect(0, 0, W, H)
    this.overlay.setVisible(true)

    this.overlayText
      .setText(result.win ? '🎯 WIN!' : 'MISS')
      .setColor(result.win ? '#FFD700' : '#FF3A2D')
      .setVisible(true).setScale(0.5).setAlpha(1)
    this.tweens.add({ targets: this.overlayText, scale: 1, duration: 300, ease: 'Back.easeOut' })

    this.overlaySubText
      .setText(result.win ? '₦' + result.payout.toLocaleString() : 'Better luck next time')
      .setVisible(true).setAlpha(0)
    this.tweens.add({ targets: this.overlaySubText, alpha: 1, duration: 400, delay: 250 })

    if (result.win) {
      for (let i = 0; i < 28; i++) {
        const p = this.add.graphics().setDepth(12)
        const colors = [0xFFD700, 0x00F0FF, 0x00E676, 0xFFFFFF, 0xFF3A2D]
        p.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1)
        p.fillCircle(0, 0, 2 + Math.random() * 4)
        p.setPosition(cx, this.dartboardCY)
        const angle = Math.random() * Math.PI * 2
        const dist  = 60 + Math.random() * 180
        this.tweens.add({
          targets: p,
          x: cx + Math.cos(angle) * dist,
          y: this.dartboardCY + Math.sin(angle) * dist,
          alpha: 0, scale: 0.2,
          duration: 800 + Math.random() * 500, ease: 'Power2',
          onComplete: () => p.destroy()
        })
      }
    }

    this.time.delayedCall(result.win ? 2600 : 2000, () => {
      this.tweens.add({
        targets: [this.overlay, this.overlayText, this.overlaySubText],
        alpha: 0, duration: 300,
        onComplete: () => {
          this.overlay.setVisible(false).setAlpha(1)
          this.overlayText.setVisible(false).setAlpha(1)
          this.overlaySubText.setVisible(false).setAlpha(1)
          this.numberDisplay.setText('?').setColor('#ffffff').setScale(1)
          this.bullseye.clear()
          this.bullseye.fillStyle(0xFF3A2D, 1)
          this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, this.bullseyeRadius)
          this.drawSpotlight(this.dartboardCX, this.dartboardCY, this.layoutScale)
          this.isPlacing = false
          this.currentPick = null
          const leftX  = this.cx - this.btnGap - this.btnW / 2
          const rightX = this.cx + this.btnGap + this.btnW / 2
          this.drawPickBtn(this.lowGfx,  leftX,  this.btnY, this.btnW, this.btnH, false, 'LOW')
          this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, this.btnH, false, 'HIGH')
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
    const err = this.add.text(cx, 60, message, {
      fontSize: '13px', color: '#ff4444',
      backgroundColor: '#1a0000', padding: { x: 12, y: 8 },
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(20)
    this.time.delayedCall(3000, () => err.destroy())
  }

  update(_time: number, delta: number) {
    if (this.crosshairContainer) {
      this.crosshairContainer.rotation += 0.003
    }
    this.auroraTime += delta * 0.0004
    const W = this.scale.width
    const H = this.scale.height
    this.aurora1.clear()
    this.aurora1.fillStyle(0x00F0FF, 0.035)
    this.aurora1.fillEllipse(
      W * 0.25 + Math.sin(this.auroraTime) * 40,
      H * 0.3  + Math.cos(this.auroraTime * 0.7) * 30,
      W * 0.8, H * 0.5
    )
    this.aurora2.clear()
    this.aurora2.fillStyle(0x4B00FF, 0.045)
    this.aurora2.fillEllipse(
      W * 0.75 + Math.cos(this.auroraTime * 0.8) * 35,
      H * 0.55 + Math.sin(this.auroraTime * 0.6) * 25,
      W * 0.7, H * 0.4
    )
    this.glitchTimer += delta
    if (this.glitchTimer > 3000 + Math.random() * 4000) {
      this.glitchTimer = 0
      this.triggerGlitch()
    }
  }

  private triggerGlitch() {
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