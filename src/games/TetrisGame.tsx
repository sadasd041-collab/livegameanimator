import { useEffect, useMemo, useReducer } from 'react'
import type { GameSignals } from '../types'

type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
type Cell = Kind | null
type Piece = { kind: Kind; rotation: number; x: number; y: number }
type State = { board: Cell[][]; piece: Piece; seed: number; next: number; score: number; lines: number; locked: number; resets: number }
type Action = { type: 'tick' | 'left' | 'right' | 'rotate' | 'drop' } | { type: 'reset'; seed: number }

const WIDTH = 10
const HEIGHT = 18
const ORDER: Kind[] = ['T', 'I', 'L', 'S', 'O', 'J', 'Z']
const BASE: Record<Kind, Array<[number, number]>> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
}

const emptyBoard = () => Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(null))
const spawn = (seed: number): Piece => ({ kind: ORDER[Math.abs(seed) % ORDER.length], rotation: 0, x: 3, y: -1 })

function cells(piece: Piece) {
  return BASE[piece.kind].map(([sourceX, sourceY]) => {
    let x = sourceX
    let y = sourceY
    for (let turn = 0; turn < piece.rotation % 4; turn += 1) [x, y] = [3 - y, x]
    return [piece.x + x, piece.y + y] as [number, number]
  })
}

function blocked(board: Cell[][], piece: Piece) {
  return cells(piece).some(([x, y]) => x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && board[y][x] !== null))
}

function lock(state: State, piece = state.piece): State {
  const board = state.board.map((row) => [...row])
  for (const [x, y] of cells(piece)) if (y >= 0 && y < HEIGHT) board[y][x] = piece.kind
  const remaining = board.filter((row) => row.some((cell) => cell === null))
  const cleared = HEIGHT - remaining.length
  const nextBoard = [...Array.from({ length: cleared }, () => Array<Cell>(WIDTH).fill(null)), ...remaining]
  const nextSeed = state.seed + state.next
  const nextPiece = spawn(nextSeed)
  if (blocked(nextBoard, nextPiece)) {
    const fresh = emptyBoard()
    return { ...state, board: fresh, piece: spawn(nextSeed + 1), next: state.next + 2, score: state.score + cleared * cleared * 100, lines: state.lines + cleared, locked: state.locked + 1, resets: state.resets + 1 }
  }
  return { ...state, board: nextBoard, piece: nextPiece, next: state.next + 1, score: state.score + 10 + cleared * cleared * 100, lines: state.lines + cleared, locked: state.locked + 1 }
}

function initial(seed: number): State {
  return { board: emptyBoard(), piece: spawn(seed), seed, next: 1, score: 0, lines: 0, locked: 0, resets: 0 }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'reset') return initial(action.seed)
  if (action.type === 'left' || action.type === 'right') {
    const candidate = { ...state.piece, x: state.piece.x + (action.type === 'left' ? -1 : 1) }
    return blocked(state.board, candidate) ? state : { ...state, piece: candidate }
  }
  if (action.type === 'rotate') {
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...state.piece, rotation: (state.piece.rotation + 1) % 4, x: state.piece.x + kick }
      if (!blocked(state.board, candidate)) return { ...state, piece: candidate }
    }
    return state
  }
  if (action.type === 'drop') {
    let piece = state.piece
    let distance = 0
    while (!blocked(state.board, { ...piece, y: piece.y + 1 })) { piece = { ...piece, y: piece.y + 1 }; distance += 1 }
    const settled = lock(state, piece)
    return { ...settled, score: settled.score + distance * 2 }
  }
  const candidate = { ...state.piece, y: state.piece.y + 1 }
  return blocked(state.board, candidate) ? lock(state) : { ...state, piece: candidate }
}

export function TetrisGame({ round, running, signal, lastActor }: { round: number; running: boolean; signal: GameSignals['tetris']; lastActor: string | null }) {
  const [state, dispatch] = useReducer(reducer, round, initial)

  useEffect(() => dispatch({ type: 'reset', seed: round }), [round])
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), Math.max(220, 720 - Math.floor(state.lines / 5) * 55))
    return () => window.clearInterval(timer)
  }, [running, state.lines])
  useEffect(() => {
    if (!signal.lastAction) return
    dispatch({ type: signal.lastAction })
  }, [signal.actionSeq, signal.lastAction])

  const ghost = useMemo(() => {
    let piece = state.piece
    while (!blocked(state.board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 }
    return new Set(cells(piece).map(([x, y]) => `${x}:${y}`))
  }, [state.board, state.piece])
  const active = new Map(cells(state.piece).map(([x, y]) => [`${x}:${y}`, state.piece.kind]))
  const nextKind = ORDER[Math.abs(state.seed + state.next) % ORDER.length]

  return <div className="tetris-scene">
    <div className="tetris-heading"><small>YORUMLARLA ORTAK OYUN</small><h2>TOPLULUK TETRİS</h2><p>Tek tahta, binlerce oyuncu. Satırları birlikte tamamlayın.</p></div>
    <div className="tetris-layout">
      <div className="tetris-board" aria-label="Tetris oyun tahtası">
        {state.board.flatMap((row, y) => row.map((settled, x) => {
          const key = `${x}:${y}`
          const kind = active.get(key) || settled
          return <i key={key} className={`${kind ? `filled tetromino-${kind}` : ''} ${!kind && ghost.has(key) ? 'ghost' : ''}`} />
        }))}
      </div>
      <div className="tetris-panel">
        <section><small>SKOR</small><strong>{state.score.toLocaleString('tr-TR')}</strong></section>
        <section><small>SATIR</small><strong>{state.lines}</strong></section>
        <section><small>SONRAKİ</small><div className={`next-tetromino tetromino-${nextKind}`}>{nextKind}</div></section>
        <section><small>YORUM</small><strong>{signal.commands}</strong></section>
      </div>
    </div>
    <div className="tetris-event"><span>{lastActor || 'Topluluk'}</span><strong>{signal.lastAction === 'drop' ? 'parçayı indirdi' : signal.lastAction === 'rotate' ? 'parçayı döndürdü' : signal.lastAction === 'left' ? 'sola taşıdı' : signal.lastAction === 'right' ? 'sağa taşıdı' : 'hamle bekleniyor'}</strong></div>
  </div>
}
