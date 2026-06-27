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
  private lowHit!: Phaser.GameObjects.Rectangle
  private highHit!: Phaser.GameObjects.Rectangle

  private aurora1!: Phaser.GameObjects.Graphics
  private aurora2!: Phaser.GameObjects.Graphics
  private auroraTime: number = 0

  private spotlight!: Phaser.GameObjects.Graphics

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

  // Total roll duration in ms — used to time win/loss sound exactly at reveal
  // delays array sums to: 120+110+100+90+80+70+65+60+60+65+70+80+90+110+130 = 1300ms
  

  constructor() {
    super('GameScene')
  }

  preload() {
    this.load.audio('click',   '/sounds/click.wav')
    this.load.audio('select',  '/sounds/select.wav')
    this.load.audio('roll1',   '/sounds/roll1.wav')
    this.load.audio('roll2',   '/sounds/roll2.wav')
    this.load.audio('win',     '/sounds/win.wav')
    this.load.audio('loss',    '/sounds/loss.wav')
    this.load.audio('bgmusic', '/sounds/background.mp3')
  }

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
      this.tweens.killTweensOf(this.crosshairContainer)
      this.crosshairContainer.setAlpha(1)
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

    // Resume audio context immediately — parent page interaction already
    // satisfied the browser autoplay policy before the iframe loaded
    this.time.delayedCall(300, () => {
      if (this.sound && (this.sound as any).context) {
        (this.sound as any).context.resume().then(() => {
          this.sound.play('bgmusic', { loop: true, volume: 0.12 })
        }).catch(() => {
          // Fallback: try playing directly
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

    this.dartboardCX = this.cx
    this.dartboardCY = H * 0.40

    this.cameras.main.setBackgroundColor('#05001A')

    this.aurora1 = this.add.graphics()
    this.aurora2 = this.add.graphics()
    this.drawAurora(W, H)

    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    this.spotlight = this.add.graphics()
    this.drawSpotlight(this.cx, this.dartboardCY)

    this.createGlitchTitle(this.cx, 28)

    this.add.text(this.cx, 58, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: '10px', color: '#00F0FF'
    }).setOrigin(0.5)

    this.createDartboard(this.cx, this.dartboardCY)

    this.add.text(this.cx, this.dartboardCY + 112, '1.80×', {
      fontSize: '20px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5)
    this.add.text(this.cx, this.dartboardCY + 135, 'payout multiplier', {
      fontSize: '10px', color: '#444444'
    }).setOrigin(0.5)

    this.createPickButtons(W, H)

    this.overlay = this.add.graphics().setVisible(false).setDepth(10)
    this.overlayText = this.add.text(this.cx, H / 2 - 40, '', {
      fontSize: '56px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5).setVisible(false).setDepth(11)
    this.overlaySubText = this.add.text(this.cx, H / 2 + 24, '', {
      fontSize: '20px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false).setDepth(11)

    this.scale.on('resize', () => { this.scene.restart() })
  }

  private drawAurora(W: number, H: number) {
    this.aurora1.clear()
    this.aurora1.fillStyle(0x00F0FF, 0.04)
    this.aurora1.fillEllipse(W * 0.25, H * 0.3, W * 0.8, H * 0.5)
    this.aurora2.clear()
    this.aurora2.fillStyle(0x4B00FF, 0.05)
    this.aurora2.fillEllipse(W * 0.75, H * 0.5, W * 0.7, H * 0.4)
  }

  private drawSpotlight(cx: number, cy: number) {
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
      this.spotlight.fillCircle(cx, cy, r)
    })
  }

  private createGlitchTitle(cx: number, y: number) {
    const style = {
      fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#00F0FF', strokeThickness: 1
    }
    this.titleGlitch1 = this.add.text(cx - 2, y, 'SHARP SHOOTER', {
      ...style, color: '#FF3A2D', stroke: '#FF3A2D', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)
    this.titleGlitch2 = this.add.text(cx + 2, y, 'SHARP SHOOTER', {
      ...style, color: '#00F0FF', stroke: '#00F0FF', strokeThickness: 0
    }).setOrigin(0.5).setAlpha(0).setDepth(1)
    this.add.text(cx, y, 'SHARP SHOOTER', style)
      .setOrigin(0.5).setDepth(2)
  }

  private createPickButtons(W: number, H: number) {
    this.btnW = Math.floor(W * 0.40)
    this.btnGap = Math.floor(W * 0.05)
    this.btnY = H * 0.775

    const leftX  = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2

    // LOW
    this.lowGfx = this.add.graphics()
    this.drawPickBtn(this.lowGfx, leftX, this.btnY, this.btnW, 64, false, 'LOW')
    this.lowText = this.add.text(leftX, this.btnY - 10, 'LOW', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.lowSub = this.add.text(leftX, this.btnY + 13, '1 - 5', {
      fontSize: '12px', color: '#4B6EF5'
    }).setOrigin(0.5)
    this.lowHit = this.add.rectangle(leftX, this.btnY, this.btnW, 64)
      .setInteractive({ useHandCursor: true })
    this.lowHit.on('pointerdown', () => {
      if (this.isPlacing) return
      // select sound: plays at t=0, ~80ms duration, done before any other sound
      this.sound.play('select', { volume: 0.5 })
      this.currentPick = 'LOW'
      this.highlightPick('LOW')
      window.parent.postMessage(
        { type: 'PICK_SELECTED', payload: { pick: 'LOW' } },
        this.PARENT_ORIGIN
      )
    })

    // HIGH
    this.highGfx = this.add.graphics()
    this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, 64, false, 'HIGH')
    this.highText = this.add.text(rightX, this.btnY - 10, 'HIGH', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
    this.highSub = this.add.text(rightX, this.btnY + 13, '6 - 10', {
      fontSize: '12px', color: '#FF3A2D'
    }).setOrigin(0.5)
    this.highHit = this.add.rectangle(rightX, this.btnY, this.btnW, 64)
      .setInteractive({ useHandCursor: true })
    this.highHit.on('pointerdown', () => {
      if (this.isPlacing) return
      // select sound: plays at t=0, ~80ms duration, done before any other sound
      this.sound.play('select', { volume: 0.5 })
      this.currentPick = 'HIGH'
      this.highlightPick('HIGH')
      window.parent.postMessage(
        { type: 'PICK_SELECTED', payload: { pick: 'HIGH' } },
        this.PARENT_ORIGIN
      )
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
      g.lineStyle(1, borderColor, 0.6)
      g.lineBetween(x - w / 2 + 12, y - h / 2 + 2, x + w / 2 - 12, y - h / 2 + 2)
    }
  }

  private highlightPick(pick: 'HIGH' | 'LOW') {
    const leftX  = this.cx - this.btnGap - this.btnW / 2
    const rightX = this.cx + this.btnGap + this.btnW / 2
    this.drawPickBtn(this.lowGfx,  leftX,  this.btnY, this.btnW, 64, pick === 'LOW',  'LOW')
    this.drawPickBtn(this.highGfx, rightX, this.btnY, this.btnW, 64, pick === 'HIGH', 'HIGH')
    this.lowText.setColor(pick === 'LOW'  ? '#4B6EF5' : '#ffffff')
    this.highText.setColor(pick === 'HIGH' ? '#FF3A2D' : '#ffffff')
    this.lowSub.setColor(pick === 'LOW'   ? '#ffffff' : '#4B6EF5')
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
      { x: 24,     y: 24     }, { x: W - 24, y: 24     },
      { x: 24,     y: H - 24 }, { x: W - 24, y: H - 24 },
      { x: W / 2,  y: 24     }, { x: W / 2,  y: H - 24 },
      { x: 24,     y: H / 2  }, { x: W - 24, y: H / 2  }
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

    // t=0ms: click sound, short ~60ms, finishes before roll starts
    this.sound.play('click', { volume: 0.6 })

    // t=0ms: crosshair pulse starts while waiting for backend response
    this.tweens.add({
      targets: this.crosshairContainer,
      alpha: 0.3,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
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

    // Stop crosshair pulse immediately
    this.tweens.killTweensOf(this.crosshairContainer)
    this.crosshairContainer.setAlpha(1)

    // Resume audio context in case it was suspended between interactions
    if ((this.sound as any).context?.state === 'suspended') {
      (this.sound as any).context.resume()
    }

    // Precise delay sequence (ms):
    // tick 0:  t=0      roll1
    // tick 1:  t=120    roll2
    // tick 2:  t=230    roll1
    // tick 3:  t=330    roll2
    // tick 4:  t=420    roll1
    // tick 5:  t=500    roll2
    // tick 6:  t=570    roll1
    // tick 7:  t=635    roll2
    // tick 8:  t=695    roll1
    // tick 9:  t=755    roll2
    // tick 10: t=820    roll1
    // tick 11: t=890    roll2
    // tick 12: t=970    roll1
    // tick 13: t=1060   roll2
    // tick 14: t=1170   → FINAL REVEAL (no roll sound here)
    // t=1170ms: number lands, bullseye flashes white
    // t=1270ms: bullseye settles green/red + win/loss sound plays (100ms after land)
    // t=1270ms: screen flash
    // t=1270ms: overlay begins scale-in (300ms duration, done at t=1570ms)
    // t=1520ms: subtext fades in (250ms delay after overlay start, done at ~t=1920ms)
    // WIN:  overlay holds until t=1270+2600=3870ms then fades 300ms → reset at t=4170ms
    // LOSS: overlay holds until t=1270+2000=3270ms then fades 300ms → reset at t=3570ms

    const delays = [120, 110, 100, 90, 80, 70, 65, 60, 60, 65, 70, 80, 90, 110, 130]
    let elapsed = 0

    delays.forEach((delay, i) => {
      this.time.delayedCall(elapsed, () => {
        if (i < delays.length - 1) {
          // Roll ticks — alternate roll1/roll2, no overlap since each fires
          // after previous delay has passed (minimum 60ms gap between ticks)
          this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
          this.sound.play(i % 2 === 0 ? 'roll1' : 'roll2', { volume: 0.25 })
        } else {
          // t=1170ms — final number reveal, NO roll sound here
          this.numberDisplay.setText(String(roll))

          // t=1170ms: bullseye flashes white instantly
          this.bullseye.clear()
          this.bullseye.fillStyle(0xFFFFFF, 1)
          this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)

          // t=1270ms (100ms later): settle color + win/loss sound + flash + overlay
          this.time.delayedCall(100, () => {
            // Bullseye settles
            this.bullseye.clear()
            this.bullseye.fillStyle(result.win ? 0x00E676 : 0xFF4444, 1)
            this.bullseye.fillCircle(this.dartboardCX, this.dartboardCY, 15)

            if (result.win) {
              // win sound at t=1270ms — ~1200ms duration, will be done before reset
              this.sound.play('win', { volume: 0.8 })
              this.numberDisplay.setColor('#00E676')
              this.tweens.add({
                targets: this.numberDisplay,
                scale: 1.4, duration: 150, yoyo: true
              })
              // Green spotlight
              this.spotlight.clear()
              const winLayers = [
                { r: 20,  alpha: 0.30, color: 0x00E676 },
                { r: 60,  alpha: 0.15, color: 0x00E676 },
                { r: 120, alpha: 0.07, color: 0x00E676 },
              ]
              winLayers.forEach(({ r, alpha, color }) => {
                this.spotlight.fillStyle(color, alpha)
                this.spotlight.fillCircle(this.dartboardCX, this.dartboardCY, r)
              })
              // Ring ripples staggered: t=1270, t=1350, t=1430, t=1510ms
              ;[92, 72, 52, 32].forEach((r, ri) => {
                const ring = this.add.graphics().setDepth(8)
                ring.lineStyle(2, 0x00E676, 0.8)
                ring.strokeCircle(this.dartboardCX, this.dartboardCY, r)
                this.tweens.add({
                  targets: ring,
                  scaleX: 1.5, scaleY: 1.5,
                  alpha: 0,
                  duration: 600,
                  delay: ri * 80,
                  ease: 'Power2',
                  onComplete: () => ring.destroy()
                })
              })
            } else {
              // loss sound at t=1270ms — ~800ms duration, done before reset
              this.sound.play('loss', { volume: 0.7 })
              this.numberDisplay.setColor('#FF4444')
              // Camera shake: 250ms duration, done at t=1520ms
              this.cameras.main.shake(250, 0.006)
            }

            // Screen flash at t=1270ms — fades over 350ms, done at t=1620ms
            const flash = this.add.graphics().setDepth(20)
            flash.fillStyle(result.win ? 0x00E676 : 0xFF3A2D, 0.15)
            flash.fillRect(0, 0, this.scale.width, this.scale.height)
            this.tweens.add({
              targets: flash,
              alpha: 0,
              duration: 350,
              onComplete: () => flash.destroy()
            })

            // Overlay starts at t=1270ms
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

    // Background overlay — instant
    this.overlay.clear()
    this.overlay.fillStyle(result.win ? 0x001a00 : 0x1a0000, 0.92)
    this.overlay.fillRect(0, 0, W, H)
    this.overlay.setVisible(true)

    // WIN/MISS text scales in over 300ms — done at t=1570ms
    this.overlayText
      .setText(result.win ? '🎯 WIN!' : 'MISS')
      .setColor(result.win ? '#FFD700' : '#FF3A2D')
      .setVisible(true)
      .setScale(0.5)
      .setAlpha(1)

    this.tweens.add({
      targets: this.overlayText,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })

    // Subtext fades in starting at t=1520ms (250ms delay), done at t=1920ms
    this.overlaySubText
      .setText(result.win
        ? '₦' + result.payout.toLocaleString()
        : 'Better luck next time')
      .setVisible(true)
      .setAlpha(0)

    this.tweens.add({
      targets: this.overlaySubText,
      alpha: 1,
      duration: 400,
      delay: 250,
    })

    // Win particles burst — 28 particles from dartboard center
    if (result.win) {
      for (let i = 0; i < 28; i++) {
        const p = this.add.graphics().setDepth(12)
        const colors = [0xFFD700, 0x00F0FF, 0x00E676, 0xFFFFFF, 0xFF3A2D]
        p.fillStyle(colors[Math.floor(Math.random() * colors.length)], 1)
        const size = 2 + Math.random() * 4
        p.fillCircle(0, 0, size)
        p.setPosition(cx, this.dartboardCY)
        const angle = Math.random() * Math.PI * 2
        const dist  = 60 + Math.random() * 180
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

    // WIN: overlay holds for 2600ms from t=1270ms → fades at t=3870ms, reset at t=4170ms
    // LOSS: overlay holds for 2000ms from t=1270ms → fades at t=3270ms, reset at t=3570ms
    // win sound (~1200ms) finishes well before reset at t=4170ms ✓
    // loss sound (~800ms) finishes well before reset at t=3570ms ✓
    this.time.delayedCall(result.win ? 2600 : 2000, () => {
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
          this.drawSpotlight(this.dartboardCX, this.dartboardCY)
          this.isPlacing = false
          this.currentPick = null
          const leftX  = this.cx - this.btnGap - this.btnW / 2
          const rightX = this.cx + this.btnGap + this.btnW / 2
          this.drawPickBtn(this.lowGfx,  leftX,  this.btnY, this.btnW, 64, false, 'LOW')
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