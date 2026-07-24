import { Gauge } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { GameSignals } from '../types'
import { FallingPickaxeEngine, type PickaxeSnapshot } from './pickaxeEngine'

type PickaxeGameProps = {
  round: number
  running: boolean
  state: GameSignals['pickaxe']
  lastActor: string | null
}

const tierNames: Record<GameSignals['pickaxe']['tier'], string> = {
  wood: 'Tahta', stone: 'Taş', iron: 'Demir', gold: 'Altın', diamond: 'Elmas', netherite: 'Netherit',
}
const oreNames: Record<keyof GameSignals['pickaxe']['ores'], string> = {
  coal: 'Kömür', copper: 'Bakır', iron: 'Demir', gold: 'Altın', crystal: 'Elmas', emerald: 'Zümrüt',
}
const orePalettes: Record<keyof GameSignals['pickaxe']['ores'], readonly [string, string, string]> = {
  coal: ['#17191c', '#343940', '#68717a'],
  copper: ['#85442e', '#c26a43', '#eca06d'],
  iron: ['#817b6f', '#bdb6a5', '#ece5d3'],
  gold: ['#8c6506', '#e1ad0e', '#ffe75f'],
  crystal: ['#087986', '#24c5cd', '#86fff2'],
  emerald: ['#087044', '#16bc6d', '#68f4a7'],
}

function OreIcon({ ore }: { ore: keyof GameSignals['pickaxe']['ores'] }) {
  const [dark, base, light] = orePalettes[ore]
  return <svg className="ore-pixel-icon" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
    <rect width="16" height="16" fill="#60666a" />
    <path fill="#747b7e" d="M0 0h7v3h4v2h5v6h-3v5H6v-2H0z" />
    <path fill="#4b5053" d="M0 4h3v5H1v4h5v3H0zm10-4h6v5h-3V3h-3zM8 11h5v5H8z" />
    <path fill={dark} d="M3 2h4v3H5v2H2V4h1zm7 5h4v4h-2v2H9V9h1z" />
    <path fill={base} d="M4 2h3v2H5v2H3V4h1zm7 6h3v3h-2v2h-2V9h1zM4 11h3v3H3v-2h1z" />
    <path fill={light} d="M5 2h2v1H5zm6 6h2v2h-1v1h-1zM4 11h2v1H4z" />
    <path fill="rgba(255,255,255,.12)" d="M0 0h16v1H0zM0 0h1v16H0z" />
  </svg>
}
const emptySnapshot: PickaxeSnapshot = {
  depth: 0, mined: 0, combo: 0, energy: 0, tier: 'wood', speed: 'normal', bigRemaining: 0,
  tnt: 0, megaTnt: 0, lastOre: null,
  ores: { coal: 0, copper: 0, iron: 0, gold: 0, crystal: 0, emerald: 0 },
}

export function PickaxeGame({ round, running, state, lastActor }: PickaxeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<FallingPickaxeEngine | null>(null)
  const lastEvent = useRef(0)
  const [hud, setHud] = useState<PickaxeSnapshot>(emptySnapshot)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new FallingPickaxeEngine({ canvas, round, onSnapshot: setHud })
    engineRef.current = engine
    engine.setRunning(running)
    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
  }, [round])

  useEffect(() => engineRef.current?.setRunning(running), [running])

  useEffect(() => {
    if (!state.combo || state.combo === lastEvent.current) return
    lastEvent.current = state.combo
    engineRef.current?.applyEvent(state.lastAction, state.tier, lastActor)
  }, [lastActor, state.combo, state.lastAction, state.tier])

  const statusText = state.lastAction === 'tnt'
    ? `${lastActor || 'Topluluk'} TNT gönderdi`
    : state.lastAction === 'mega'
      ? `${lastActor || 'Topluluk'} Mega TNT çağırdı`
      : state.lastAction === 'big'
        ? `${lastActor || 'Topluluk'} kazmayı büyüttü`
        : state.lastAction === 'fast' || state.lastAction === 'slow'
          ? `${lastActor || 'Topluluk'} fiziği ${state.lastAction === 'fast' ? 'hızlandırdı' : 'yavaşlattı'}`
          : state.lastAction === 'tier'
            ? `${lastActor || 'Topluluk'} ${tierNames[state.tier]} kazmayı seçti`
            : 'Kazma yerçekimiyle ilerliyor'

  return <div className={`pickaxe-scene physics-mode speed-${hud.speed} tier-${hud.tier} ${hud.bigRemaining > 0 ? 'is-big' : ''} ${running ? 'running' : ''}`}>
    <div className="pickaxe-cavern" aria-hidden="true"><i /><i /><i /></div>
    <div className="pickaxe-playfield physics-playfield">
      <canvas ref={canvasRef} aria-label="Fizik tabanlı düşen kazma oyun sahnesi" />
      <div className="physics-depth"><small>DERİNLİK</small><strong>Y: -{hud.depth}</strong></div>

      <aside className="pickaxe-loot-rail" aria-label="Toplanan cevherler">
        <header>GANİMET</header>
        <div className="pickaxe-ores">
          {(Object.keys(hud.ores) as Array<keyof typeof hud.ores>).map((ore) => <span className={ore} key={ore}><OreIcon ore={ore} /><small>{oreNames[ore]}</small><b>{hud.ores[ore]}</b></span>)}
        </div>
      </aside>

      <div className="pickaxe-tool-status" aria-label={`${hud.speed === 'fast' ? 'Hızlı' : hud.speed === 'slow' ? 'Yavaş' : 'Normal'} ${tierNames[hud.tier]} kazma`}>
        <span><Gauge size={9} />{hud.speed === 'fast' ? 'HIZLI' : hud.speed === 'slow' ? 'YAVAŞ' : 'NORMAL'}</span>
        <strong>{tierNames[hud.tier]} kazma</strong>
        {hud.bigRemaining > 0 && <em>{hud.bigRemaining} sn BÜYÜK</em>}
      </div>
      <div className="pickaxe-energy-line" aria-label={`Maden enerjisi yüzde ${hud.energy}`}><i><b style={{ width: `${hud.energy}%` }} /></i><span>%{hud.energy}</span></div>
      <div className={`pickaxe-actor pickaxe-actor-overlay ${state.lastAction || ''}`}>{statusText}</div>
    </div>
  </div>
}
