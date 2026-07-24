import { Bodies, Body, Composite, Engine, Events, Vector, type IEventCollision } from 'matter-js'
import type { GameSignals } from '../types'

const WORLD_WIDTH = 540
const BLOCK_SIZE = 60
const COLUMNS = 9
const FIRST_SOLID_ROW = 8
const PICKAXE_START_Y = 255

export type OreKind = keyof GameSignals['pickaxe']['ores']
export type PickaxeTier = GameSignals['pickaxe']['tier']
type BlockKind = 'bedrock' | 'grass' | 'dirt' | 'stone' | 'andesite' | 'diorite' | 'granite' | 'cobble' | 'mossy' | OreKind | 'obsidian'

type BlockCell = {
  body: Body
  row: number
  column: number
  kind: BlockKind
  hp: number
  maxHp: number
  firstHitAt: number | null
  lastHealAt: number | null
}

type FallingBomb = { body: Body; mega: boolean; owner: string; detonateAt: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export type PickaxeSnapshot = {
  depth: number
  mined: number
  combo: number
  energy: number
  tier: PickaxeTier
  speed: 'slow' | 'normal' | 'fast'
  bigRemaining: number
  tnt: number
  megaTnt: number
  lastOre: OreKind | null
  ores: Record<OreKind, number>
}

type EngineOptions = { canvas: HTMLCanvasElement; onSnapshot: (snapshot: PickaxeSnapshot) => void; round: number }

const tierDamage: Record<PickaxeTier, number> = { wood: 2, stone: 4, iron: 6, gold: 8, diamond: 10, netherite: 12 }
const pickaxeMaterialPalettes: Record<PickaxeTier, readonly [string, string, string]> = {
  wood: ['#4a2915', '#855126', '#bd7d38'],
  stone: ['#464744', '#747570', '#aaa9a2'],
  iron: ['#77766f', '#b9b8ad', '#f0eee0'],
  gold: ['#8f5e04', '#d99c0c', '#ffe052'],
  diamond: ['#087985', '#20bdc5', '#83fff1'],
  netherite: ['#211a20', '#493743', '#79616c'],
}
const blockHp: Record<BlockKind, number> = {
  bedrock: 1_000_000_000, grass: 1, dirt: 1, stone: 10, andesite: 10, diorite: 10, granite: 10,
  cobble: 22, mossy: 12, coal: 15, copper: 15, iron: 15, gold: 20,
  crystal: 20, emerald: 20, obsidian: 100,
}
const blockColors: Record<BlockKind, [string, string, string]> = {
  bedrock: ['#282828', '#111111', '#5b5b5b'], grass: ['#6b8144', '#4a642f', '#8ea45b'], dirt: ['#805a3e', '#5e3d2b', '#a6754d'], stone: ['#7d7d7d', '#606060', '#9b9b9b'],
  andesite: ['#8a8a86', '#6b6b68', '#aaa9a4'], diorite: ['#d4d2cd', '#9c9b98', '#efeee9'],
  granite: ['#9a6657', '#74483f', '#bd8270'], cobble: ['#707070', '#474747', '#949494'],
  mossy: ['#66705a', '#46503f', '#7e9561'], coal: ['#777777', '#171717', '#a0a0a0'],
  copper: ['#777777', '#9d5b3c', '#e08a57'], iron: ['#777777', '#a89b84', '#ded4bd'],
  gold: ['#777777', '#b9860c', '#ffdc43'], crystal: ['#777777', '#178e9a', '#55edf1'],
  emerald: ['#777777', '#0b8f55', '#4ff29c'], obsidian: ['#181124', '#09070e', '#5a3478'],
}

type PixelPalette = readonly [string, string, string, string]
const blockTexturePalettes: Record<BlockKind, PixelPalette> = {
  bedrock: ['#101010', '#242424', '#3c3c3c', '#595959'],
  grass: ['#50341f', '#69452c', '#82583a', '#9b6c45'],
  dirt: ['#50341f', '#69452c', '#82583a', '#9b6c45'],
  stone: ['#5f5f5f', '#747474', '#858585', '#999999'],
  andesite: ['#696966', '#7d7d79', '#90908b', '#aaa9a4'],
  diorite: ['#8f8e8b', '#b7b6b2', '#d2d0cb', '#eceae5'],
  granite: ['#70463e', '#89584c', '#a36b5d', '#bd8371'],
  cobble: ['#414141', '#595959', '#707070', '#898989'],
  mossy: ['#414141', '#595959', '#707070', '#898989'],
  coal: ['#606060', '#727272', '#838383', '#969696'],
  copper: ['#606060', '#727272', '#838383', '#969696'],
  iron: ['#606060', '#727272', '#838383', '#969696'],
  gold: ['#606060', '#727272', '#838383', '#969696'],
  crystal: ['#606060', '#727272', '#838383', '#969696'],
  emerald: ['#606060', '#727272', '#838383', '#969696'],
  obsidian: ['#09070e', '#151020', '#21162f', '#382047'],
}
const orePixelPalettes: Partial<Record<BlockKind, readonly [string, string, string]>> = {
  coal: ['#111111', '#242424', '#3a3a3a'], copper: ['#8f4930', '#bd6842', '#e59662'],
  iron: ['#958974', '#b9aa90', '#ddd1b8'], gold: ['#9b7207', '#e4b416', '#ffe45a'],
  crystal: ['#087a87', '#24c6d2', '#6ff6f6'], emerald: ['#087544', '#13b868', '#55f5a0'],
}
const blockKinds: BlockKind[] = ['bedrock', 'grass', 'dirt', 'stone', 'andesite', 'diorite', 'granite', 'cobble', 'mossy', 'coal', 'copper', 'iron', 'gold', 'crystal', 'emerald', 'obsidian']

const seeded = (row: number, column: number, salt: number) => {
  const value = Math.sin(row * 127.1 + column * 311.7 + salt * 73.9) * 43758.5453
  return value - Math.floor(value)
}

const chooseBlock = (row: number, column: number, salt: number): BlockKind => {
  if (column === 0 || column === COLUMNS - 1 || row === 0) return 'bedrock'
  if (row === FIRST_SOLID_ROW) return 'grass'
  if (row === FIRST_SOLID_ROW + 1) return 'dirt'
  const roll = seeded(row, column, salt)
  if (roll < .006) return 'emerald'
  if (roll < .022) return 'crystal'
  if (roll < .052) return 'obsidian'
  if (roll < .095) return 'gold'
  if (roll < .16) return 'iron'
  if (roll < .225) return 'copper'
  if (roll < .305) return 'coal'
  if (roll < .39) return 'mossy'
  if (roll < .55) return 'cobble'
  if (roll < .68) return 'granite'
  if (roll < .8) return 'diorite'
  if (roll < .9) return 'andesite'
  return 'stone'
}

const oreForBlock = (kind: BlockKind): OreKind | null => ['coal', 'copper', 'iron', 'gold', 'crystal', 'emerald'].includes(kind) ? kind as OreKind : null

export class FallingPickaxeEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private engine = Engine.create({ enableSleeping: false })
  private pickaxe: Body
  private pickaxeTextures = new Map<PickaxeTier, HTMLCanvasElement>()
  private blocks = new Map<string, BlockCell>()
  private blockByBody = new WeakMap<Body, BlockCell>()
  private blockTextures = new Map<string, HTMLCanvasElement>()
  private bombs: FallingBomb[] = []
  private particles: Particle[] = []
  private generatedThroughRow = -1
  private cameraY = 0
  private shake = 0
  private animationFrame = 0
  private lastFrame = performance.now()
  private lastSnapshotAt = 0
  private lastCollisionDampingAt = 0
  private running = false
  private speed: PickaxeSnapshot['speed'] = 'normal'
  private speedUntil = 0
  private bigUntil = 0
  private enlarged = false
  private tier: PickaxeTier = 'wood'
  private round: number
  private nextAutoTnt = 0
  private nextAutoPower = 0
  private onSnapshot: (snapshot: PickaxeSnapshot) => void
  private stats: PickaxeSnapshot = {
    depth: 0, mined: 0, combo: 0, energy: 0, tier: 'wood', speed: 'normal', bigRemaining: 0,
    tnt: 0, megaTnt: 0, lastOre: null,
    ores: { coal: 0, copper: 0, iron: 0, gold: 0, crystal: 0, emerald: 0 },
  }

  constructor({ canvas, onSnapshot, round }: EngineOptions) {
    this.canvas = canvas
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context oluşturulamadı.')
    this.ctx = context
    this.onSnapshot = onSnapshot
    this.round = round
    this.engine.gravity.y = 1.15
    this.engine.gravity.scale = .001

    const handle = Bodies.rectangle(WORLD_WIDTH / 2, PICKAXE_START_Y + 16, 25, 118)
    const head = Bodies.rectangle(WORLD_WIDTH / 2, PICKAXE_START_Y - 40, 138, 28)
    this.pickaxe = Body.create({
      parts: [handle, head], restitution: .31, friction: .78, frictionAir: .007,
      density: .006, label: 'falling-pickaxe',
    })
    Body.setAngle(this.pickaxe, -.72)
    Body.setAngularVelocity(this.pickaxe, .052)
    Body.setVelocity(this.pickaxe, { x: 1.5, y: 0 })
    Composite.add(this.engine.world, this.pickaxe)
    this.ensureTerrain(34)
    Events.on(this.engine, 'collisionActive', this.handleCollision)
    this.nextAutoTnt = performance.now() + 9000
    this.nextAutoPower = performance.now() + 15000
    this.resize()
    this.animationFrame = requestAnimationFrame(this.frame)
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect()
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio))
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio))
  }

  setRunning(value: boolean) { this.running = value }

  applyEvent(action: GameSignals['pickaxe']['lastAction'], tier: PickaxeTier, actor: string | null) {
    const now = performance.now()
    if (action === 'tnt') this.spawnBomb(false, actor || 'Topluluk')
    if (action === 'mega') this.spawnBomb(true, actor || 'Topluluk')
    if (action === 'fast' || action === 'slow') {
      this.speed = action
      this.speedUntil = now + 5000
    }
    if (action === 'big') this.enlarge(now + 5000)
    if (action === 'tier') this.setTier(tier)
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    Events.off(this.engine, 'collisionActive', this.handleCollision)
    Composite.clear(this.engine.world, false, true)
    Engine.clear(this.engine)
  }

  private setTier(tier: PickaxeTier) {
    this.tier = tier
    this.stats.tier = tier
  }

  private enlarge(until: number) {
    this.bigUntil = Math.max(this.bigUntil, until)
    if (!this.enlarged) {
      Body.scale(this.pickaxe, 1.65, 1.65)
      this.enlarged = true
    }
  }

  private resetSize() {
    if (!this.enlarged) return
    Body.scale(this.pickaxe, 1 / 1.65, 1 / 1.65)
    this.enlarged = false
  }

  private handleCollision = (event: IEventCollision<Engine>) => {
    const timestamp = this.engine.timing.timestamp
    for (const pair of event.pairs) {
      const a = pair.bodyA.parent || pair.bodyA
      const b = pair.bodyB.parent || pair.bodyB
      const block = a === this.pickaxe ? this.blockByBody.get(b) : b === this.pickaxe ? this.blockByBody.get(a) : null
      if (!block || block.kind === 'bedrock') continue
      if (block.lastHealAt !== null && timestamp - block.lastHealAt < 115) continue
      const impact = Math.max(1, Math.min(2.4, Vector.magnitude(this.pickaxe.velocity) / 7))
      const damage = tierDamage[this.tier] * (this.enlarged ? 2 : 1) * impact
      block.hp -= damage
      block.firstHitAt ??= timestamp
      block.lastHealAt = timestamp
      this.stats.combo += 1
      if (timestamp - this.lastCollisionDampingAt > 90) {
        this.lastCollisionDampingAt = timestamp
        const velocity = this.pickaxe.velocity
        Body.setVelocity(this.pickaxe, {
          x: Math.max(-9, Math.min(9, velocity.x * .9)),
          y: Math.max(-8, Math.min(21, velocity.y * .93)),
        })
        let angularVelocity = Math.max(-.115, Math.min(.115, this.pickaxe.angularVelocity * .92))
        if (Math.abs(angularVelocity) < .012) angularVelocity = (seeded(block.row, block.column, this.round) > .5 ? 1 : -1) * .018
        Body.setAngularVelocity(this.pickaxe, angularVelocity)
      }
      if (block.hp <= 0) this.breakBlock(block)
    }
  }

  private addBlock(row: number, column: number) {
    const key = `${row}:${column}`
    if (this.blocks.has(key)) return
    const kind = chooseBlock(row, column, this.round)
    const body = Bodies.rectangle(column * BLOCK_SIZE + BLOCK_SIZE / 2, row * BLOCK_SIZE + BLOCK_SIZE / 2, BLOCK_SIZE - 1, BLOCK_SIZE - 1, {
      isStatic: true, restitution: .28, friction: 1, label: `block:${kind}`,
    })
    const block: BlockCell = { body, row, column, kind, hp: blockHp[kind], maxHp: blockHp[kind], firstHitAt: null, lastHealAt: null }
    this.blocks.set(key, block)
    this.blockByBody.set(body, block)
    Composite.add(this.engine.world, body)
  }

  private ensureTerrain(targetRow: number) {
    for (let row = this.generatedThroughRow + 1; row <= targetRow; row += 1) {
      if (row < 0) continue
      for (let column = 0; column < COLUMNS; column += 1) {
        if (row < FIRST_SOLID_ROW && row !== 0 && column > 0 && column < COLUMNS - 1) continue
        this.addBlock(row, column)
      }
    }
    this.generatedThroughRow = Math.max(this.generatedThroughRow, targetRow)
  }

  private breakBlock(block: BlockCell) {
    Composite.remove(this.engine.world, block.body)
    this.blocks.delete(`${block.row}:${block.column}`)
    this.stats.mined += 1
    this.stats.energy = Math.min(100, this.stats.energy + 3)
    const ore = oreForBlock(block.kind)
    if (ore) {
      this.stats.ores[ore] += ore === 'crystal' || ore === 'emerald' ? 1 : block.kind === 'coal' ? 2 : 1
      this.stats.lastOre = ore
    }
    this.spawnDebris(block.body.position.x, block.body.position.y, blockColors[block.kind][2], 9)
  }

  private spawnBomb(mega: boolean, owner: string) {
    const size = mega ? 88 : 54
    const body = Bodies.rectangle(this.pickaxe.position.x, this.pickaxe.position.y - 190, size, size, {
      restitution: .35, friction: .7, density: mega ? .01 : .006, label: mega ? 'mega-tnt' : 'tnt',
    })
    Body.setAngularVelocity(body, (seeded(this.stats.tnt + this.stats.megaTnt, owner.length, this.round) - .5) * .13)
    Composite.add(this.engine.world, body)
    this.bombs.push({ body, mega, owner, detonateAt: this.engine.timing.timestamp + 4000 })
    if (mega) this.stats.megaTnt += 1
    else this.stats.tnt += 1
  }

  private explode(bomb: FallingBomb) {
    const radius = bomb.mega ? BLOCK_SIZE * 5.6 : BLOCK_SIZE * 3.15
    for (const block of [...this.blocks.values()]) {
      if (block.kind === 'bedrock') continue
      const distance = Vector.magnitude(Vector.sub(block.body.position, bomb.body.position))
      if (distance > radius) continue
      block.hp -= (1 - distance / radius) * (bomb.mega ? 190 : 105)
      block.firstHitAt ??= this.engine.timing.timestamp
      block.lastHealAt = this.engine.timing.timestamp
      if (block.hp <= 0) this.breakBlock(block)
    }
    Composite.remove(this.engine.world, bomb.body)
    this.bombs = this.bombs.filter((item) => item !== bomb)
    this.shake = bomb.mega ? 28 : 14
    this.spawnDebris(bomb.body.position.x, bomb.body.position.y, bomb.mega ? '#cf78ff' : '#ffb23f', bomb.mega ? 65 : 34)
  }

  private spawnDebris(x: number, y: number, color: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = seeded(index, Math.round(x + y), this.round) * Math.PI * 2
      const speed = 2 + seeded(index + 8, Math.round(y), this.round) * 7
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2, life: 1, maxLife: .55 + seeded(index + 19, count, this.round) * .7, color, size: 3 + seeded(index + 4, count, this.round) * 8 })
    }
  }

  private frame = (time: number) => {
    const delta = Math.min(34, Math.max(8, time - this.lastFrame))
    this.lastFrame = time
    if (this.running) this.update(delta, time)
    this.draw(time)
    this.animationFrame = requestAnimationFrame(this.frame)
  }

  private update(delta: number, now: number) {
    if (this.speedUntil && now >= this.speedUntil) {
      this.speed = 'normal'
      this.speedUntil = 0
    }
    if (this.bigUntil && now >= this.bigUntil) {
      this.resetSize()
      this.bigUntil = 0
    }
    this.engine.timing.timeScale = this.speed === 'fast' ? 1.8 : this.speed === 'slow' ? .52 : 1
    // Matter.js is most stable at 60 Hz. Split delayed browser frames instead of
    // feeding one oversized step that can tunnel through thin blocks.
    let remaining = delta
    while (remaining > 0) {
      const step = Math.min(16.5, remaining)
      Engine.update(this.engine, step)
      remaining -= step
    }
    const velocity = this.pickaxe.velocity
    if (Math.abs(velocity.x) > 9 || velocity.y > 22 || velocity.y < -8) {
      Body.setVelocity(this.pickaxe, {
        x: Math.max(-9, Math.min(9, velocity.x)),
        y: Math.max(-8, Math.min(22, velocity.y)),
      })
    }
    if (Math.abs(this.pickaxe.angularVelocity) > .12) {
      Body.setAngularVelocity(this.pickaxe, Math.sign(this.pickaxe.angularVelocity) * .12)
    }

    const visibleWorldHeight = this.canvas.clientHeight / Math.max(.01, this.canvas.clientWidth / WORLD_WIDTH)
    const desiredCamera = this.pickaxe.position.y - visibleWorldHeight * .38
    this.cameraY += (desiredCamera - this.cameraY) * .085
    const neededRow = Math.ceil((this.pickaxe.position.y + visibleWorldHeight * 1.3) / BLOCK_SIZE)
    this.ensureTerrain(neededRow)
    this.cleanupTerrain(Math.floor(this.cameraY / BLOCK_SIZE) - 8)

    for (const bomb of [...this.bombs]) if (this.engine.timing.timestamp >= bomb.detonateAt) this.explode(bomb)
    for (const block of this.blocks.values()) {
      if (block.firstHitAt === null || block.hp >= block.maxHp || block.kind === 'bedrock') continue
      if (this.engine.timing.timestamp - block.firstHitAt >= 5000 && block.lastHealAt !== null && this.engine.timing.timestamp - block.lastHealAt >= 5000) {
        block.hp = Math.min(block.maxHp, block.hp + block.maxHp * .2)
        block.lastHealAt = this.engine.timing.timestamp
      }
    }
    for (const particle of this.particles) {
      particle.x += particle.vx * delta / 16.67
      particle.y += particle.vy * delta / 16.67
      particle.vy += .24 * delta / 16.67
      particle.life -= delta / 1000 / particle.maxLife
    }
    this.particles = this.particles.filter((particle) => particle.life > 0)

    if (now >= this.nextAutoTnt) {
      this.spawnBomb(false, 'Otomatik olay')
      this.nextAutoTnt = now + 9000 + seeded(this.stats.tnt, this.round, 3) * 9000
    }
    if (now >= this.nextAutoPower) {
      const roll = seeded(this.stats.combo, this.round, 8)
      if (roll < .34) this.enlarge(now + 5000)
      else if (roll < .67) { this.speed = roll < .5 ? 'fast' : 'slow'; this.speedUntil = now + 5000 }
      else this.setTier((['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'] as PickaxeTier[])[Math.floor(roll * 6) % 6])
      this.nextAutoPower = now + 14000 + roll * 12000
    }

    this.stats.depth = Math.max(0, Math.floor((this.pickaxe.position.y - PICKAXE_START_Y) / BLOCK_SIZE))
    this.stats.speed = this.speed
    this.stats.bigRemaining = Math.max(0, Math.ceil((this.bigUntil - now) / 1000))
    this.stats.tier = this.tier
    if (now - this.lastSnapshotAt >= 160) {
      this.lastSnapshotAt = now
      this.onSnapshot({ ...this.stats, ores: { ...this.stats.ores } })
    }
  }

  private cleanupTerrain(beforeRow: number) {
    for (const block of [...this.blocks.values()]) {
      if (block.row >= beforeRow || block.kind === 'bedrock' && block.row >= beforeRow - 6) continue
      Composite.remove(this.engine.world, block.body)
      this.blocks.delete(`${block.row}:${block.column}`)
    }
  }

  private draw(time: number) {
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const scale = width / WORLD_WIDTH
    const ctx = this.ctx
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.scale(scale, scale)
    const shakeX = this.shake ? (seeded(Math.floor(time / 16), 2, this.round) - .5) * this.shake : 0
    const shakeY = this.shake ? (seeded(Math.floor(time / 16), 5, this.round) - .5) * this.shake : 0
    this.shake *= .9
    ctx.translate(shakeX, -this.cameraY + shakeY)

    for (const block of this.blocks.values()) this.drawBlock(block)
    for (const bomb of this.bombs) this.drawBomb(bomb, time)
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life)
      ctx.fillStyle = particle.color
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
    }
    ctx.globalAlpha = 1
    this.drawPickaxe()
    ctx.restore()
  }

  private drawBlock(block: BlockCell) {
    const ctx = this.ctx
    const x = block.column * BLOCK_SIZE + .5
    const y = block.row * BLOCK_SIZE + .5
    const variant = Math.floor(seeded(block.row, block.column, this.round) * 6)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.getBlockTexture(block.kind, variant), x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1)
    ctx.fillStyle = 'rgba(255,255,255,.045)'
    ctx.fillRect(x, y, BLOCK_SIZE - 1, 1.5)
    ctx.fillRect(x, y, 1.5, BLOCK_SIZE - 1)
    ctx.fillStyle = 'rgba(0,0,0,.18)'
    ctx.fillRect(x, y + BLOCK_SIZE - 2.5, BLOCK_SIZE - 1, 1.5)
    ctx.fillRect(x + BLOCK_SIZE - 2.5, y, 1.5, BLOCK_SIZE - 1)
    if (block.hp < block.maxHp) {
      const damage = 1 - block.hp / block.maxHp
      const pixel = (BLOCK_SIZE - 1) / 16
      ctx.fillStyle = `rgba(10,8,9,${.54 + damage * .4})`
      const crack = (px: number, py: number, wide = 1, tall = 1) => ctx.fillRect(x + px * pixel, y + py * pixel, wide * pixel, tall * pixel)
      crack(8, 2); crack(7, 3); crack(7, 4); crack(6, 5); crack(7, 6); crack(8, 7); crack(8, 8); crack(7, 9); crack(6, 10); crack(6, 11); crack(5, 12)
      if (damage > .3) { crack(6, 5); crack(5, 5); crack(4, 4); crack(3, 4); crack(8, 8); crack(9, 8); crack(10, 7); crack(11, 7) }
      if (damage > .62) { crack(7, 9); crack(8, 10); crack(9, 11); crack(9, 12); crack(4, 4); crack(4, 3); crack(3, 2); crack(10, 7); crack(11, 8); crack(12, 8); crack(13, 9) }
    }
  }

  private getBlockTexture(kind: BlockKind, variant: number) {
    const key = `${kind}:${variant}`
    const cached = this.blockTextures.get(key)
    if (cached) return cached
    const texture = document.createElement('canvas')
    texture.width = 16
    texture.height = 16
    const ctx = texture.getContext('2d')!
    const palette = blockTexturePalettes[kind]
    const kindSeed = blockKinds.indexOf(kind) + 1
    const cobbled = kind === 'cobble' || kind === 'mossy'

    for (let py = 0; py < 16; py += 1) {
      for (let px = 0; px < 16; px += 1) {
        const fine = seeded(py + variant * 23, px + kindSeed * 17, kindSeed + this.round * 5)
        const coarse = seeded(Math.floor(py / 2) + variant * 7, Math.floor(px / 2) + kindSeed * 3, kindSeed * 11)
        const noise = fine * .42 + coarse * .58
        let paletteIndex = noise < .18 ? 0 : noise < .52 ? 1 : noise < .84 ? 2 : 3

        if (kind === 'bedrock') paletteIndex = noise < .3 ? 0 : noise < .6 ? 1 : noise < .84 ? 2 : 3
        if (kind === 'obsidian') {
          const streak = (px + variant * 3 + Math.floor(py / 4)) % 7 === 0
          paletteIndex = streak && noise > .35 ? 3 : noise < .3 ? 0 : noise < .7 ? 1 : 2
        }
        if (cobbled) {
          const course = Math.floor(py / 4)
          const shiftedX = px + (course % 2) * 2 + variant
          const mortar = py % 4 === 0 || shiftedX % 5 === 0
          if (mortar) paletteIndex = 0
          else paletteIndex = Math.max(1, paletteIndex)
        }

        ctx.fillStyle = palette[paletteIndex]
        ctx.fillRect(px, py, 1, 1)
      }
    }

    if (kind === 'grass') {
      const greens = ['#31551f', '#477126', '#5c8b32', '#79a842']
      for (let py = 0; py < 4; py += 1) for (let px = 0; px < 16; px += 1) {
        const grassNoise = seeded(py + variant * 5, px + 83, this.round + 37)
        ctx.fillStyle = greens[Math.min(3, Math.floor(grassNoise * 4))]
        ctx.fillRect(px, py, 1, 1)
      }
      for (let px = 0; px < 16; px += 1) {
        const hanging = seeded(px, variant + 71, this.round + 53)
        if (hanging > .48) {
          ctx.fillStyle = greens[hanging > .78 ? 2 : 1]
          ctx.fillRect(px, 4, 1, hanging > .76 ? 3 : 2)
          if (hanging > .88 && px < 15) ctx.fillRect(px + 1, 4, 1, 1)
        }
      }
    }

    if (cobbled) {
      ctx.fillStyle = 'rgba(255,255,255,.13)'
      for (let course = 0; course < 4; course += 1) {
        const py = course * 4 + 1
        for (let px = 1; px < 16; px += 5) ctx.fillRect((px + course * 2 + variant) % 15, py, 3, 1)
      }
    }

    if (kind === 'mossy') {
      const greens = ['#30451f', '#49652b', '#6e843d']
      for (let py = 0; py < 16; py += 1) for (let px = 0; px < 16; px += 1) {
        const moss = seeded(py + variant * 13, px + 47, this.round + 91)
        const edgeGrowth = py < 4 || px < 3 || (px + py + variant) % 11 === 0
        if (edgeGrowth && moss > .61) {
          ctx.fillStyle = greens[Math.min(2, Math.floor(moss * 3))]
          ctx.fillRect(px, py, 1, 1)
        }
      }
    }

    const orePalette = orePixelPalettes[kind]
    if (orePalette) {
      const centers = [
        [3 + variant % 2, 3], [11, 3 + variant % 3], [7 + variant % 3, 8],
        [3, 12 - variant % 2], [12 - variant % 2, 12], [5 + variant % 4, 14],
      ]
      for (const [centerX, centerY] of centers) {
        for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
          const px = centerX + dx
          const py = centerY + dy
          if (px < 1 || px > 14 || py < 1 || py > 14) continue
          const shape = Math.abs(dx) + Math.abs(dy)
          const vein = seeded(px + variant * 19, py + kindSeed * 13, this.round + 151)
          if (shape > 1 && !(shape === 2 && vein > .72)) continue
          ctx.fillStyle = orePalette[shape === 0 ? 2 : vein > .48 ? 1 : 0]
          ctx.fillRect(px, py, 1, 1)
        }
      }
    }

    this.blockTextures.set(key, texture)
    return texture
  }

  private drawPickaxe() {
    const ctx = this.ctx
    const size = this.enlarged ? 238 : 152
    ctx.save()
    ctx.translate(this.pickaxe.position.x, this.pickaxe.position.y)
    ctx.rotate(this.pickaxe.angle)
    ctx.imageSmoothingEnabled = false
    ctx.shadowColor = this.tier === 'diamond' ? 'rgba(73,245,239,.48)' : this.tier === 'gold' ? 'rgba(255,211,64,.36)' : 'rgba(0,0,0,.58)'
    ctx.shadowBlur = this.enlarged ? 22 : 11
    ctx.drawImage(this.getPickaxeTexture(this.tier), -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  private getPickaxeTexture(tier: PickaxeTier) {
    const cached = this.pickaxeTextures.get(tier)
    if (cached) return cached
    const texture = document.createElement('canvas')
    texture.width = 48
    texture.height = 48
    const ctx = texture.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const [materialDark, materialBase, materialLight] = pickaxeMaterialPalettes[tier]
    const outline = '#171417'
    const handleDark = '#3c2414'
    const handleBase = tier === 'wood' ? '#75451f' : '#805326'
    const handleLight = tier === 'wood' ? '#aa7134' : '#b17a3b'

    const drawRows = (color: string, rows: Array<[number, number, number]>) => {
      ctx.fillStyle = color
      rows.forEach(([x, y, width]) => ctx.fillRect(x, y, width, 1))
    }

    // Original 48px voxel art: long tapered cutting points, a thick eye and
    // a slimmer wooden shaft make the object read as a pickaxe at every angle.
    drawRows(outline, [
      [18, 5, 12], [13, 6, 22], [10, 7, 28], [7, 8, 34], [5, 9, 38], [3, 10, 42], [1, 11, 46],
      [0, 12, 48], [0, 13, 17], [20, 13, 8], [31, 13, 17], [1, 14, 13], [20, 14, 8], [34, 14, 13],
      [2, 15, 10], [20, 15, 8], [36, 15, 10], [3, 16, 8], [20, 16, 8], [37, 16, 8],
      [4, 17, 6], [20, 17, 8], [38, 17, 6], [5, 18, 4], [20, 18, 8], [39, 18, 4],
      [6, 19, 3], [20, 19, 8], [39, 19, 3], [20, 20, 8],
      [20, 21, 8], [20, 22, 8], [20, 23, 8], [20, 24, 8], [20, 25, 8], [20, 26, 8],
      [20, 27, 8], [20, 28, 8], [20, 29, 8], [20, 30, 8], [20, 31, 8], [20, 32, 8],
      [20, 33, 8], [20, 34, 8], [20, 35, 8], [20, 36, 8], [20, 37, 8], [20, 38, 8],
      [20, 39, 8], [20, 40, 8], [20, 41, 8], [20, 42, 8], [20, 43, 8], [21, 44, 6], [22, 45, 4],
    ])
    drawRows(materialDark, [
      [18, 6, 12], [13, 7, 22], [10, 8, 28], [7, 9, 34], [5, 10, 38], [3, 11, 42],
      [2, 12, 44], [2, 13, 14], [21, 13, 6], [32, 13, 14], [3, 14, 10], [21, 14, 6], [35, 14, 10],
      [4, 15, 7], [21, 15, 6], [37, 15, 7], [5, 16, 5], [21, 16, 6], [38, 16, 5],
      [6, 17, 3], [21, 17, 6], [39, 17, 3], [7, 18, 2], [21, 18, 6], [39, 18, 2], [21, 19, 6],
    ])
    drawRows(materialBase, [
      [19, 7, 10], [14, 8, 20], [11, 9, 26], [8, 10, 32], [6, 11, 36], [4, 12, 40],
      [4, 13, 10], [22, 13, 4], [34, 13, 10], [5, 14, 7], [22, 14, 4], [36, 14, 7],
      [6, 15, 4], [22, 15, 4], [38, 15, 4], [7, 16, 2], [22, 16, 4], [39, 16, 2],
      [22, 17, 4], [22, 18, 4], [22, 19, 4],
    ])
    drawRows(materialLight, [
      [19, 7, 6], [14, 8, 13], [11, 9, 15], [8, 10, 17], [6, 11, 15], [4, 12, 12],
      [4, 13, 7], [22, 13, 2], [5, 14, 4], [22, 14, 2], [6, 15, 2], [22, 15, 2],
    ])

    // Wooden shaft and the material socket around it.
    ctx.fillStyle = handleDark
    ctx.fillRect(21, 19, 6, 25)
    ctx.fillStyle = handleBase
    ctx.fillRect(22, 20, 4, 23)
    ctx.fillStyle = handleLight
    ctx.fillRect(22, 20, 1, 21)
    ctx.fillStyle = materialDark
    ctx.fillRect(19, 15, 10, 7)
    ctx.fillStyle = materialBase
    ctx.fillRect(21, 16, 6, 5)
    ctx.fillStyle = materialLight
    ctx.fillRect(22, 16, 2, 4)

    this.pickaxeTextures.set(tier, texture)
    return texture
  }

  private drawBomb(bomb: FallingBomb, time: number) {
    const ctx = this.ctx
    const { x, y } = bomb.body.position
    const size = bomb.mega ? 88 : 54
    const pulse = .6 + Math.sin(time / 90) * .25
    ctx.save(); ctx.translate(x, y); ctx.rotate(bomb.body.angle)
    ctx.fillStyle = bomb.mega ? '#6b26b7' : '#b62227'; ctx.fillRect(-size / 2, -size / 2, size, size)
    ctx.fillStyle = `rgba(255,255,255,${pulse})`; ctx.fillRect(-size / 2, -size * .12, size, size * .24)
    ctx.fillStyle = '#170c12'; ctx.font = `900 ${bomb.mega ? 14 : 11}px Manrope`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bomb.mega ? 'MEGA' : 'TNT', 0, 1)
    ctx.restore()
    ctx.save(); ctx.font = '700 9px Manrope'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(bomb.owner, x, y - size * .7); ctx.restore()
  }
}
