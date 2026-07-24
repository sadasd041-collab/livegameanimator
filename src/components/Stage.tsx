import { useEffect, useRef } from 'react'
import { Eye, Heart, MessageCircle, Radio } from 'lucide-react'
import { playSoundCue } from '../audio'
import { games } from '../data'
import { CountryWheel } from '../games/CountryWheel'
import { FootballGame } from '../games/FootballGame'
import { QuizGame } from '../games/QuizGame'
import { EmojiGuessGame } from '../games/EmojiGuessGame'
import { NumberBattleGame } from '../games/NumberBattleGame'
import { PickaxeGame } from '../games/PickaxeGame'
import { RaidGame } from '../games/RaidGame'
import { WordRushGame } from '../games/WordRushGame'
import { TetrisGame } from '../games/TetrisGame'
import type { ComboNotice, CosmeticEvent, FootballSetup, GameId, GameSignals, NextGameVoteOption, RoundResult } from '../types'

type StageProps = {
  game: GameId
  round: number
  running: boolean
  progress: number
  vertical: boolean
  signals: GameSignals
  footballSetup: FootballSetup
  soundEnabled?: boolean
  soundVolume?: number
  roundResult?: RoundResult | null
  cosmeticEvent?: CosmeticEvent | null
  comboNotice?: ComboNotice | null
  nextVoteOpen?: boolean
  nextVoteOptions?: NextGameVoteOption[]
  continuous?: boolean
  clean?: boolean
}

type StageCommandItem = { token: string; label?: string }

function commandsForGame(game: GameId, footballSetup: FootballSetup): StageCommandItem[] {
  if (game === 'football') return [
    { token: footballSetup.home.command.toUpperCase(), label: footballSetup.home.shortName },
    { token: footballSetup.away.command.toUpperCase(), label: footballSetup.away.shortName },
  ]
  if (game === 'quiz') return ['A', 'B', 'C', 'D'].map((token) => ({ token }))
  if (game === 'wheel') return [{ token: 'ÜLKE ADI', label: 'Örn. Türkiye' }]
  if (game === 'emoji') return [{ token: 'TAHMİNİN', label: 'Cevabı yaz' }]
  if (game === 'word') return [{ token: 'KELİME', label: 'Cevabı yaz' }]
  if (game === 'numbers') return [{ token: '1', label: 'Sol taraf' }, { token: '2', label: 'Sağ taraf' }]
  if (game === 'raid') return [{ token: 'VUR', label: 'Bossa saldır' }, { token: 'İYİLEŞ', label: 'Can doldur' }]
  if (game === 'tetris') return [{ token: 'SOL' }, { token: 'SAĞ' }, { token: 'DÖNDÜR' }, { token: 'İNDİR' }]
  return ['TNT', 'MEGA', 'HIZLI', 'YAVAŞ', 'BÜYÜK', 'TAHTA', 'TAŞ', 'DEMİR', 'ALTIN', 'ELMAS', 'NETHERITE'].map((token) => ({ token }))
}

export function Stage({ game, round, running, progress, vertical, signals, footballSetup, soundEnabled = true, soundVolume = .45, roundResult = null, cosmeticEvent = null, comboNotice = null, nextVoteOpen = false, nextVoteOptions = [], continuous = false, clean = false }: StageProps) {
  const definition = games.find((item) => item.id === game) ?? games[0]
  const commandItems = commandsForGame(game, footballSetup)
  const previousRound = useRef(round)
  const previousWinners = useRef(signals.emoji.winners.length + signals.word.winners.length)
  const previousFootballVotes = useRef(signals.football.home + signals.football.away)
  const previousResult = useRef<number | null>(null)

  useEffect(() => {
    if (previousRound.current !== round) {
      if (clean && soundEnabled) playSoundCue(game === 'wheel' ? 'spin' : 'round', soundVolume)
      previousRound.current = round
    }
  }, [clean, game, round, soundEnabled, soundVolume])

  useEffect(() => {
    const winners = signals.emoji.winners.length + signals.word.winners.length
    if (clean && soundEnabled && winners > previousWinners.current) playSoundCue('success', soundVolume)
    previousWinners.current = winners
  }, [clean, signals.emoji.winners.length, signals.word.winners.length, soundEnabled, soundVolume])

  useEffect(() => {
    const votes = signals.football.home + signals.football.away
    if (clean && soundEnabled && votes > previousFootballVotes.current && votes % 5 === 0) playSoundCue('goal', soundVolume)
    previousFootballVotes.current = votes
  }, [clean, signals.football.away, signals.football.home, soundEnabled, soundVolume])

  useEffect(() => {
    if (clean && soundEnabled && roundResult && previousResult.current !== roundResult.id) playSoundCue('success', soundVolume)
    previousResult.current = roundResult?.id || null
  }, [clean, roundResult, soundEnabled, soundVolume])

  return (
    <section className={`broadcast-stage ${vertical ? 'vertical' : 'landscape'} ${clean ? 'clean-stage' : ''}`}>
      <div className="stage-noise" />
      {!clean && (
        <div className="stage-meta">
          <div className={`live-badge ${running ? 'active' : ''}`}><Radio size={12} />{running ? 'CANLI' : 'ÖNİZLEME'}</div>
          <div className="stage-viewers"><Eye size={13} /> {running ? '1,8 B' : 'Yerel'}</div>
        </div>
      )}

      <div className="stage-brand">
        <span className="brand-glyph">L</span>
        <div><strong>LIVE ARENA</strong><small>{definition.shortName}</small></div>
      </div>

      <div className="game-slot">
        {game === 'football' && <FootballGame round={round} running={running} votes={signals.football} lastActor={signals.lastActor} teams={footballSetup} />}
        {game === 'quiz' && <QuizGame round={round} progress={progress} votes={signals.quiz} continuous={continuous} />}
        {game === 'wheel' && <CountryWheel round={round} running={running} votes={signals.wheel} />}
        {game === 'emoji' && <EmojiGuessGame round={round} attempts={signals.emoji.attempts} winners={signals.emoji.winners} progress={progress} continuous={continuous} />}
        {game === 'word' && <WordRushGame round={round} attempts={signals.word.attempts} winners={signals.word.winners} progress={progress} continuous={continuous} />}
        {game === 'numbers' && <NumberBattleGame votes={signals.numbers} lastActor={signals.lastActor} />}
        {game === 'pickaxe' && <PickaxeGame round={round} running={running} state={signals.pickaxe} lastActor={signals.lastActor} />}
        {game === 'raid' && <RaidGame round={round} damage={signals.raid.damage} hits={signals.raid.hits} lastDamage={signals.raid.lastDamage} communityHp={signals.raid.communityHp} heals={signals.raid.heals} healing={signals.raid.healing} lastHeal={signals.raid.lastHeal} bossAttacks={signals.raid.bossAttacks} lastBossDamage={signals.raid.lastBossDamage} lastAction={signals.raid.lastAction} lastActor={signals.lastActor} continuous={continuous} />}
        {game === 'tetris' && <TetrisGame round={round} running={running} signal={signals.tetris} lastActor={signals.lastActor} />}
      </div>

      <aside className={`stage-command-dock stage-command-${game}`} aria-label={`${definition.shortName} yorum komutları`}>
        <header><MessageCircle size={10} /><div><strong>YORUM KOMUTLARI</strong><small><b>!</b> isteğe bağlı</small></div></header>
        <div className="stage-command-list">
          {commandItems.map((item) => <span key={`${item.token}-${item.label || ''}`}><b>{item.token}</b>{item.label && <small>{item.label}</small>}</span>)}
        </div>
        <footer>Yoruma doğrudan yaz</footer>
      </aside>

      {nextVoteOpen && nextVoteOptions.length > 0 && <div className="next-game-poll"><div><small>SONRAKİ OYUNU SEN SEÇ</small><strong>Yoruma oy 1, oy 2 veya oy 3 yaz</strong></div><section>{nextVoteOptions.map((option, index) => <span key={option.id}><em>{index + 1}</em><i>{option.icon}</i><b>{option.name}</b><strong>{option.votes}</strong></span>)}</section></div>}
      {!continuous && roundResult && <div className="round-result-overlay"><div><small>TUR SONU</small><h3>{roundResult.title}</h3><section>{roundResult.winners.map((winner, index) => <span key={`${winner.name}-${index}`}><em>{index + 1}</em><strong>{winner.name}</strong><b>{winner.score} puan</b></span>)}</section></div></div>}
      {cosmeticEvent && <div className={`cosmetic-burst ${cosmeticEvent.tone}`}><span>{cosmeticEvent.tone === 'supporter' ? '✨' : '★'}</span><div><small>{cosmeticEvent.label}</small><strong>{cosmeticEvent.author}</strong></div></div>}
      {comboNotice && <div className="combo-notice"><span>+{comboNotice.xpGain} XP</span><strong>{comboNotice.combo > 1 ? `${comboNotice.combo}x COMBO` : `Seviye puanı`}</strong></div>}

      {!clean && (
        <div className="stage-social">
          <span><Heart size={14} fill="currentColor" /> 24,8 B</span>
          <span><MessageCircle size={14} /> {signals.totalMessages}</span>
        </div>
      )}
      <div className="stage-progress"><span style={{ width: `${progress}%` }} /></div>
    </section>
  )
}
