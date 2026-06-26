import { CasinoBridge } from '../bridge'
import type { BetResult } from '../bridge'

export class GameScene extends Phaser.Scene {
  private selectedPick: 'HIGH' | 'LOW' | null = null
  private currentStake: number = 500
  private isPlacing: boolean = false
  private balance: number = 0
  private isAuthenticated: boolean = false
  private bridge!: CasinoBridge

  private lowBtn!: Phaser.GameObjects.Rectangle
  private highBtn!: Phaser.GameObjects.Rectangle
  private lowBtnText!: Phaser.GameObjects.Text
  private highBtnText!: Phaser.GameObjects.Text
  private numberDisplay!: Phaser.GameObjects.Text
  private playBtn!: Phaser.GameObjects.Rectangle
  private playBtnText!: Phaser.GameObjects.Text
  private balanceText!: Phaser.GameObjects.Text
  private stakeTexts!: Phaser.GameObjects.Text[]
  private stakeRects!: Phaser.GameObjects.Rectangle[]
  private overlay!: Phaser.GameObjects.Rectangle
  private overlayText!: Phaser.GameObjects.Text
  private overlaySubText!: Phaser.GameObjects.Text

  constructor() {
    super('GameScene')
  }

  preload() {
    // Load assets here if needed
  }

  create() {
    const PARENT_ORIGIN = import.meta.env.VITE_PARENT_ORIGIN || '*'
    this.bridge = new CasinoBridge(PARENT_ORIGIN)

    this.bridge.onInit((balance: number) => {
      this.isAuthenticated = true
      this.balance = balance
      this.balanceText.setText('Balance: ₦' + balance.toLocaleString())
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

    // Title
    this.add.text(cx, 40, 'SHARP SHOOTER', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)

    this.add.text(cx, 75, 'Pick HIGH or LOW', {
      fontSize: '14px', color: '#888888'
    }).setOrigin(0.5)

    // Balance
    this.balanceText = this.add.text(W - 16, 16, 'Balance: ₦0', {
      fontSize: '13px', color: '#aaaaaa'
    }).setOrigin(1, 0)

    // LOW button
    this.lowBtn = this.add.rectangle(cx - 90, H * 0.38, 160, 90, 0x1e2329)
      .setInteractive({ useHandCursor: true })
    this.lowBtnText = this.add.text(cx - 90, H * 0.38, 'LOW\n1 - 5', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5)

    // HIGH button  
    this.highBtn = this.add.rectangle(cx + 90, H * 0.38, 160, 90, 0x1e2329)
      .setInteractive({ useHandCursor: true })
    this.highBtnText = this.add.text(cx + 90, H * 0.38, 'HIGH\n6 - 10', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5)

    // Number display
    this.numberDisplay = this.add.text(cx, H * 0.55, '?', {
      fontSize: '72px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)

    // Quick stakes
    const stakes = [100, 500, 1000, 5000]
    this.stakeRects = []
    this.stakeTexts = []
    stakes.forEach((amount, i) => {
      const x = cx - 150 + i * 100
      const y = H * 0.68
      const rect = this.add.rectangle(x, y, 88, 36, 0x1e2329)
        .setInteractive({ useHandCursor: true })
      const txt = this.add.text(x, y, '₦' + (amount >= 1000 ? amount/1000 + 'k' : amount), {
        fontSize: '13px', color: '#888888'
      }).setOrigin(0.5)
      rect.on('pointerdown', () => {
        this.currentStake = amount
        this.updateStakeUI()
      })
      this.stakeRects.push(rect)
      this.stakeTexts.push(txt)
    })

    // Play button
    this.playBtn = this.add.rectangle(cx, H * 0.80, W - 48, 52, 0x555555)
      .setInteractive({ useHandCursor: true })
    this.playBtnText = this.add.text(cx, H * 0.80, 'Select HIGH or LOW', {
      fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5)

    // Overlay (hidden initially)
    this.overlay = this.add.rectangle(cx, H/2, W, H, 0x000000, 0.85).setVisible(false)
    this.overlayText = this.add.text(cx, H/2 - 40, '', {
      fontSize: '48px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false)
    this.overlaySubText = this.add.text(cx, H/2 + 30, '', {
      fontSize: '22px', color: '#ffffff'
    }).setOrigin(0.5).setVisible(false)

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
    const clientSeed = Math.random().toString(36).substring(2)
    this.bridge.placeBet({
      game: 'SHARP_SHOOTER',
      stake: this.currentStake,
      gameParams: { pick: this.selectedPick },
      clientSeed
    })
  }

  private handleResult(result: BetResult) {
    const roll = (result.result as { roll: number }).roll
    this.balance = result.newBalance
    this.balanceText.setText('Balance: ₦' + this.balance.toLocaleString())
    
    // Animate number rolling
    let count = 0
    const timer = this.time.addEvent({
      delay: 80,
      repeat: 12,
      callback: () => {
        this.numberDisplay.setText(String(Math.floor(Math.random() * 10) + 1))
        count++
        if (count >= 12) {
          this.numberDisplay.setText(String(roll))
          this.numberDisplay.setColor(result.win ? '#00e676' : '#ff4444')
          this.showResultOverlay(result)
        }
      }
    })
  }

  private showResultOverlay(result: BetResult) {
    const win = result.win
    this.overlay.setFillStyle(win ? 0x003300 : 0x330000).setVisible(true)
    this.overlayText.setText(win ? 'WIN!' : 'MISS').setVisible(true)
    this.overlaySubText.setText(
      win ? '₦' + result.payout.toLocaleString() : 'Better luck next time'
    ).setVisible(true)
    
    this.time.delayedCall(win ? 2500 : 2000, () => {
      this.overlay.setVisible(false)
      this.overlayText.setVisible(false)
      this.overlaySubText.setVisible(false)
      this.numberDisplay.setText('?').setColor('#ffffff')
      this.selectedPick = null
      this.lowBtn.setFillStyle(0x1e2329)
      this.highBtn.setFillStyle(0x1e2329)
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
    this.lowBtn.setFillStyle(pick === 'LOW' ? 0x00e676 : 0x1e2329)
    this.highBtn.setFillStyle(pick === 'HIGH' ? 0x00e676 : 0x1e2329)
    this.lowBtnText.setColor(pick === 'LOW' ? '#000000' : '#ffffff')
    this.highBtnText.setColor(pick === 'HIGH' ? '#000000' : '#ffffff')
    this.updatePlayButton()
  }

  private updateStakeUI() {
    const stakes = [100, 500, 1000, 5000]
    stakes.forEach((amount, i) => {
      const isSelected = this.currentStake === amount
      this.stakeRects[i].setFillStyle(isSelected ? 0x00e676 : 0x1e2329)
      this.stakeTexts[i].setColor(isSelected ? '#000000' : '#888888')
    })
    this.updatePlayButton()
  }

  private updatePlayButton() {
    if (this.selectedPick && !this.isPlacing) {
      this.playBtn.setFillStyle(0xf59e0b)
      this.playBtnText.setText('PLAY · ₦' + this.currentStake.toLocaleString())
    } else if (this.isPlacing) {
      this.playBtn.setFillStyle(0x555555)
      this.playBtnText.setText('Placing bet...')
    } else {
      this.playBtn.setFillStyle(0x555555)
      this.playBtnText.setText('Select HIGH or LOW')
    }
  }
}