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
  private lowBtnText!: Phaser.GameObjects.Text
  private highBtnText!: Phaser.GameObjects.Text
  private numberDisplay!: Phaser.GameObjects.Text
  private playBtn!: Phaser.GameObjects.Graphics
  private playBtnText!: Phaser.GameObjects.Text
  private balanceText!: Phaser.GameObjects.Text
  private stakeTexts!: Phaser.GameObjects.Text[]
  private stakeRects!: Phaser.GameObjects.Graphics[]
  private overlay!: Phaser.GameObjects.Graphics
  private overlayText!: Phaser.GameObjects.Text
  private overlaySubText!: Phaser.GameObjects.Text
  private dart!: Phaser.GameObjects.Graphics
  private crosshairLines!: Phaser.GameObjects.Line[]
  private dartboardRings!: Phaser.GameObjects.Graphics[]

  constructor() {
    super('GameScene')
  }

  preload() {
    // No assets to preload
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
    })

    this.setupUI()
  }

  private setupUI() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2

    // Background
    this.cameras.main.setBackgroundColor('#05001A')
    this.drawGrid(W, H)
    this.drawDecorativeDots(W, H)

    // Title
    this.add.text(cx, 40, 'SHARP SHOOTER', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)

    this.add.text(cx, 70, 'HIGH OR LOW · HIT THE TARGET', {
      fontSize: '11px', color: '#00F0FF'
    }).setOrigin(0.5)

    // Balance
    this.balanceText = this.add.text(W - 16, 16, '₦0', {
      fontSize: '13px', color: '#aaaaaa'
    }).setOrigin(1, 0)

    // Dartboard
    this.createDartboard(cx, H * 0.38)

    // LOW button
    this.lowBtn = this.add.graphics()
    this.drawHexagon(this.lowBtn, cx - 105, H * 0.62, 88, 70, '#0D0A2E', '#4B6EF5', 2)
    this.lowBtn.setInteractive(new Phaser.Geom.Polygon([
      cx - 105 - 44, H * 0.62 - 35,
      cx - 105, H * 0.62 - 35,
      cx - 105 + 44, H * 0.62,
      cx - 105, H * 0.62 + 35,
      cx - 105 - 44, H * 0.62 + 35,
      cx - 105 - 44, H * 0.62
    ]), Phaser.Geom.Polygon.Contains)
    this.lowBtnText = this.add.text(cx - 105, H * 0.62 - 10, 'LOW', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff', align: 'center'
    }).setOrigin(0.5)
    this.add.text(cx - 105, H * 0.62 + 15, '1 - 5', {
      fontSize: '12px', color: '#4B6EF5', align: 'center'
    }).setOrigin(0.5)

    // HIGH button
    this.highBtn = this.add.graphics()
    this.drawHexagon(this.highBtn, cx + 105, H * 0.62, 88, 70, '#2E0A0A', '#FF3A2D', 2)
    this.highBtn.setInteractive(new Phaser.Geom.Polygon([
      cx + 105 - 44, H * 0.62 - 35,
      cx + 105, H * 0.62 - 35,
      cx + 105 + 44, H * 0.62,
      cx + 105, H * 0.62 + 35,
      cx + 105 - 44, H * 0.62 + 35,
      cx + 105 - 44, H * 0.62
    ]), Phaser.Geom.Polygon.Contains)
    this.highBtnText = this.add.text(cx + 105, H * 0.62 - 10, 'HIGH', {
      fontSize: '18px', fontStyle: 'bold', color: '#ffffff', align: 'center'
    }).setOrigin(0.5)
    this.add.text(cx + 105, H * 0.62 + 15, '6 - 10', {
      fontSize: '12px', color: '#FF3A2D', align: 'center'
    }).setOrigin(0.5)

    // Multiplier display
    this.add.text(cx, H * 0.50, '1.80×', {
      fontSize: '22px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5)
    this.add.text(cx, H * 0.50 + 20, 'payout multiplier', {
      fontSize: '11px', color: '#666666'
    }).setOrigin(0.5)

    // Stake selector
    const stakes = [100, 500, 1000, 5000]
    this.stakeRects = []
    this.stakeTexts = []
    stakes.forEach((amount, i) => {
      const x = cx - 150 + i * 100
      const y = H * 0.78
      const rect = this.add.graphics()
      this.drawPill(rect, x, y, 80, 36, '#0D0A2E', '#2a2060', 1)
      rect.setInteractive(new Phaser.Geom.Ellipse(x, y, 80, 36), Phaser.Geom.Ellipse.Contains)
      const txt = this.add.text(x, y, '₦' + (amount >= 1000 ? amount/1000 + 'k' : amount), {
        fontSize: '13px', color: '#666666'
      }).setOrigin(0.5)
      rect.on('pointerdown', () => {
        this.currentStake = amount
        this.updateStakeUI()
      })
      this.stakeRects.push(rect)
      this.stakeTexts.push(txt)
    })

    // Play button
    this.playBtn = this.add.graphics()
    this.drawRoundedRect(this.playBtn, cx, H * 0.88, W - 48, 52, 14, '#1a1a2e', '#444444', 1)
    this.playBtn.setInteractive(new Phaser.Geom.Rectangle(cx - (W - 48)/2, H * 0.88 - 26, W - 48, 52), Phaser.Geom.Rectangle.Contains)
    this.playBtnText = this.add.text(cx, H * 0.88, 'Select HIGH or LOW', {
      fontSize: '16px', fontStyle: 'bold', color: '#444444'
    }).setOrigin(0.5)

    // Overlay (hidden initially)
    this.overlay = this.add.graphics()
    this.overlay.fillStyle(0x000000, 0.85).fillRect(0, 0, W, H).setVisible(false)
    this.overlayText = this.add.text(cx, H/2 - 40, '', {
      fontSize: '56px', fontStyle: 'bold', color: '#FFD700'
    }).setOrigin(0.5).setVisible(false)
    this.overlaySubText = this.add.text(cx, H/2 + 30, '', {
      fontSize: '28px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false)

    // Dart
    this.dart = this.add.graphics()
    this.drawDart(this.dart, cx, -20)
    this.dart.setVisible(false)

    // Button interactions
    this.lowBtn.on('pointerdown', () => this.selectPick('LOW'))
    this.highBtn.on('pointerdown', () => this.selectPick('HIGH'))
    this.playBtn.on('pointerdown', () => this.handlePlay())

    // Resize
    this.scale.on('resize', () => {
      this.scene.restart()
    })

    this.updateStakeUI()
  }

  private drawGrid(W: number, H: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x0A0530, 0.3)
    for (let x = 0; x < W; x += 40) {
      grid.moveTo(x, 0).lineTo(x, H)
    }
    for (let y = 0; y < H; y += 40) {
      grid.moveTo(0, y).lineTo(W, y)
    }
  }

  private drawDecorativeDots(W: number, H: number) {
    const dots = this.add.graphics()
    const positions = [
      { x: 30, y: 30 },
      { x: W - 30, y: 30 },
      { x: 30, y: H - 30 },
      { x: W - 30, y: H - 30 },
      { x: W/2, y: 30 },
      { x: W/2, y: H - 30 },
      { x: 30, y: H/2 },
      { x: W - 30, y: H/2 }
    ]
    positions.forEach((pos, i) => {
      dots.fillStyle(i % 2 === 0 ? 0x00F0FF : 0xFFD700)
      dots.fillRect(pos.x, pos.y, 5, 5)
    })
  }

  private createDartboard(cx: number, cy: number) {
    this.dartboardRings = []
    const rings = [
      { radius: 90, color: 0x1a0a4a, width: 3, alpha: 1 },
      { radius: 70, color: 0x4B6EF5, width: 2, alpha: 0.4 },
      { radius: 50, color: 0x00F0FF, width: 2, alpha: 0.6 },
      { radius: 30, color: 0xFF3A2D, width: 2, alpha: 0.7 },
      { radius: 14, color: 0xFF3A2D, width: 2, alpha: 1 }
    ]
    rings.forEach(ring => {
      const g = this.add.graphics()
      g.lineStyle(ring.width, ring.color, ring.alpha)
      if (ring.radius === 14) {
        g.fillStyle(ring.color, ring.alpha)
        g.fillCircle(cx, cy, ring.radius)
      }
      g.strokeCircle(cx, cy, ring.radius)
      this.dartboardRings.push(g)
    })

    this.crosshairLines = []
    const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4]
    angles.forEach(angle => {
      const line = this.add.line(0, 0, cx, cy, cx + Math.cos(angle) * 100, cy + Math.sin(angle) * 100, 0x00F0FF, 0.3)
      line.setOrigin(0, 0)
      this.crosshairLines.push(line)
    })

    this.numberDisplay = this.add.text(cx, cy, '?', {
      fontSize: '36px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)
  }

  private drawHexagon(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, fill: string, border: string, borderWidth: number) {
    g.fillStyle(parseInt(fill.substring(1), 16))
    g.lineStyle(borderWidth, parseInt(border.substring(1), 16))
    const points = [
      x - width/2, y - height/2,
      x, y - height/2,
      x + width/2, y,
      x, y + height/2,
      x - width/2, y + height/2,
      x - width/2, y
    ]
    g.fillPoints(points)
    g.strokePoints(points, true)
  }

  private drawPill(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, fill: string, border: string, borderWidth: number) {
    g.fillStyle(parseInt(fill.substring(1), 16))
    g.lineStyle(borderWidth, parseInt(border.substring(1), 16))
    g.fillRoundedRect(x - width/2, y - height/2, width, height, height/2)
    g.strokeRoundedRect(x - width/2, y - height/2, width, height, height/2)
  }

  private drawRoundedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, radius: number, fill: string, border: string, borderWidth: number) {
    g.fillStyle(parseInt(fill.substring(1), 16))
    g.lineStyle(borderWidth, parseInt(border.substring(1), 16))
    g.fillRoundedRect(x - width/2, y - height/2, width, height, radius)
    g.strokeRoundedRect(x - width/2, y - height/2, width, height, radius)
  }

  private drawDart(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0xFFD700)
    g.lineStyle(1, 0xFFD700)
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 6, y + 20)
    g.lineTo(x - 6, y + 20)
    g.closePath()
    g.fillPath()
    g.strokePath()
    g.lineBetween(x, y, x, y + 20)
  }

  private enableUI() {
    this.isAuthenticated = true
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
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    this.dart.setVisible(true)
    this.dart.setPosition(cx, -20)
    this.tweens.add({
      targets: this.dart,
      y: H * 0.38,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: this.dart,
            y: H + 20,
            duration: 300,
            onComplete: () => this.dart.setVisible(false)
          })
        })
      }
    })
  }

  private handleResult(result: BetResult) {
    const roll = (result.result as { roll: number }).roll
    this.balance = result.newBalance
    this.balanceText.setText('₦' + this.balance.toLocaleString())
    
    // Animate number rolling
    let count = 0
    this.time.addEvent({
      delay: 80,
      repeat: 15,
      callback: () => {
        this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
        count++
        if (count >= 15) {
          this.numberDisplay.setText(String(roll))
          if (result.win) {
            this.numberDisplay.setColor('#00E676')
            this.tweens.add({
              targets: this.numberDisplay,
              scale: 1.4,
              duration: 150,
              yoyo: true
            })
          } else {
            this.numberDisplay.setColor('#FF3A2D')
            this.tweens.add({
              targets: this.dartboardRings,
              x: '+=4',
              duration: 50,
              yoyo: true,
              repeat: 4
            })
          }
          this.showResultOverlay(result)
        }
      }
    })
  }

  private showResultOverlay(result: BetResult) {
    const win = result.win
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    
    this.overlay.clear()
    this.overlay.fillStyle(win ? 0x003300 : 0x1a0000, 0.88)
    this.overlay.fillRect(0, 0, W, H)
    this.overlay.setVisible(true)
    
    this.overlayText.setText(win ? 'WIN!' : 'MISS').setVisible(true)
    this.overlaySubText.setText(
      win ? '₦' + result.payout.toLocaleString() : 'Better luck next time'
    ).setVisible(true)
    
    if (win) {
      // Create particles
      for (let i = 0; i < 20; i++) {
        const particle = this.add.graphics()
        const color = [0xFFD700, 0x00F0FF, 0x00E676][Math.floor(Math.random() * 3)]
        particle.fillStyle(color)
        particle.fillCircle(0, 0, 2)
        particle.setPosition(cx, H * 0.38)
        this.tweens.add({
          targets: particle,
          x: cx + Math.cos(Math.random() * Math.PI * 2) * 200,
          y: H * 0.38 + Math.sin(Math.random() * Math.PI * 2) * 200,
          alpha: 0,
          duration: 1000,
          onComplete: () => particle.destroy()
        })
      }
    } else {
      // Screen shake
      this.cameras.main.shake(300, 0.005)
    }
    
    this.time.delayedCall(win ? 2500 : 2000, () => {
      this.overlay.setVisible(false)
      this.overlayText.setVisible(false)
      this.overlaySubText.setVisible(false)
      this.numberDisplay.setText('?').setColor('#ffffff')
      this.selectedPick = null
      this.lowBtn.clear()
      this.highBtn.clear()
      this.drawHexagon(this.lowBtn, this.scale.width/2 - 105, this.scale.height * 0.62, 88, 70, '#0D0A2E', '#4B6EF5', 2)
      this.drawHexagon(this.highBtn, this.scale.width/2 + 105, this.scale.height * 0.62, 88, 70, '#2E0A0A', '#FF3A2D', 2)
      this.lowBtnText.setColor('#ffffff')
      this.highBtnText.setColor('#ffffff')
      this.isPlacing = false
      this.updatePlayButton()
    })
  }

  private showError(message: string) {
    const cx = this.scale.width / 2
    const errText = this.add.text(cx, 120, message, {
      fontSize: '14px', color: '#ff4444',
      backgroundColor: '#1a0000', padding: { x: 12, y: 8 }
    }).setOrigin(0.5)
    this.time.delayedCall(3000, () => errText.destroy())
  }

  private selectPick(pick: 'HIGH' | 'LOW') {
    this.selectedPick = pick
    this.lowBtn.clear()
    this.highBtn.clear()
    if (pick === 'LOW') {
      this.drawHexagon(this.lowBtn, this.scale.width/2 - 105, this.scale.height * 0.62, 88, 70, '#1a1060', '#4B6EF5', 3)
      this.lowBtn.setBlendMode(Phaser.BlendModes.ADD)
      this.lowBtn.fillStyle(0x4B6EF5, 0.5)
      this.lowBtnText.setColor('#ffffff')
      this.drawHexagon(this.highBtn, this.scale.width/2 + 105, this.scale.height * 0.62, 88, 70, '#2E0A0A', '#FF3A2D', 2)
      this.highBtnText.setColor('#ffffff')
    } else {
      this.drawHexagon(this.lowBtn, this.scale.width/2 - 105, this.scale.height * 0.62, 88, 70, '#0D0A2E', '#4B6EF5', 2)
      this.lowBtnText.setColor('#ffffff')
      this.drawHexagon(this.highBtn, this.scale.width/2 + 105, this.scale.height * 0.62, 88, 70, '#3d0a0a', '#FF3A2D', 3)
      this.highBtn.setBlendMode(Phaser.BlendModes.ADD)
      this.highBtn.fillStyle(0xFF3A2D, 0.5)
      this.highBtnText.setColor('#ffffff')
    }
    this.updatePlayButton()
  }

  private updateStakeUI() {
    const stakes = [100, 500, 1000, 5000]
    stakes.forEach((amount, i) => {
      const isSelected = this.currentStake === amount
      this.stakeRects[i].clear()
      this.drawPill(this.stakeRects[i], this.scale.width/2 - 150 + i * 100, this.scale.height * 0.78, 80, 36, 
        isSelected ? '#1a1060' : '#0D0A2E', 
        isSelected ? '#4B6EF5' : '#2a2060', 1)
      this.stakeTexts[i].setColor(isSelected ? '#ffffff' : '#666666')
    })
    this.updatePlayButton()
  }

  private updatePlayButton() {
    this.playBtn.clear()
    if (this.selectedPick && !this.isPlacing) {
      this.drawRoundedRect(this.playBtn, this.scale.width/2, this.scale.height * 0.88, this.scale.width - 48, 52, 14, '#B8912A', '#FFFFFF', 1)
      this.playBtnText.setText('PLAY · ₦' + this.currentStake.toLocaleString()).setColor('#ffffff')
    } else if (this.isPlacing) {
      this.drawRoundedRect(this.playBtn, this.scale.width/2, this.scale.height * 0.88, this.scale.width - 48, 52, 14, '#333333', '#444444', 1)
      this.playBtnText.setText('Placing bet...').setColor('#ffffff')
    } else {
      this.drawRoundedRect(this.playBtn, this.scale.width/2, this.scale.height * 0.88, this.scale.width - 48, 52, 14, '#1a1a2e', '#444444', 1)
      this.playBtnText.setText('Select HIGH or LOW').setColor('#444444')
    }
  }

  update() {
    // Rotate crosshair lines
    this.crosshairLines.forEach(line => {
      line.rotation += 0.003
    })
  }
}