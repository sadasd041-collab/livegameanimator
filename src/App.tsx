import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleStop,
  ClipboardCopy,
  Clock3,
  Eye,
  Gamepad2,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  MonitorPlay,
  Play,
  Radio,
  RefreshCw,
  Repeat2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { applyCommand, applyRaidBossAttack, normalizeChatText, parseGameCommand, reviveRaidCommunity, type GameCommand } from './chatEngine'
import { AnalyticsView, BroadcastsView } from './components/OperationsViews'
import { Stage } from './components/Stage'
import { countries, createInitialSignals, defaultFootballSetup, emojiPuzzles, games, questions, teams, wordPuzzles } from './data'
import { raidBosses } from './games/raidData'
import { isEnglish, switchLanguage } from './locale'
import type { ActivityItem, AnalyticsSnapshot, ChatMessage, ChatStatus, ComboNotice, CosmeticEvent, FootballSetup, GameId, GameSignals, ModerationSettings, NextGameVoteOption, PlatformId, RoundResult, TeamDefinition } from './types'

type ObsStatus = { connected: boolean; streaming: boolean }
type Notice = { tone: 'success' | 'warning' | 'neutral'; text: string }
type ActiveView = 'dashboard' | 'broadcasts' | 'analytics'
type GameConfig = { order: GameId[]; durations: Record<GameId, number> }
type StreamMetadata = { title: string; description: string; tags: string }

const fallingPickaxeCredit = 'Falling Pickaxe mechanics inspired by Vycdev\nYT: https://www.youtube.com/@vycdev\nGH: https://github.com/vycdev/falling-pickaxe'

const defaultGameConfig: GameConfig = {
  order: games.map((game) => game.id),
  durations: Object.fromEntries(games.map((game) => [game.id, game.duration])) as Record<GameId, number>,
}

const emptyAnalytics: AnalyticsSnapshot = {
  createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  stats: { totalMessages: 0, acceptedMessages: 0, blockedMessages: 0, acceptedCommands: 0, uniqueAuthors: 0, byPlatform: {}, byGame: {} },
  sessions: [], events: [], weeklyLeaderboard: [],
}

const defaultModeration: ModerationSettings = { enabled: true, blockedWords: [], cooldownMs: 900, maxMessageLength: 300 }

const emptyChatStatus: ChatStatus = {
  mode: 'off', connected: false, platform: null, videoId: null, videoTitle: null,
  pollIntervalMs: null, lastMessageAt: null, error: null, messageCount: 0, recentMessages: [],
}

const initialActivity: ActivityItem[] = [
  { id: 1, kind: 'system', title: 'Sahne hazır', detail: 'Yayın motoru beklemede', time: 'şimdi' },
  { id: 2, kind: 'answer', title: 'Soru havuzu yüklendi', detail: '6 kategori aktif', time: '1 dk' },
  { id: 3, kind: 'spin', title: 'Oyun kütüphanesi hazır', detail: `${games.length} oyun rotasyonda`, time: '2 dk' },
]

const activityCopy: Record<GameId, [string, string]> = {
  football: ['Maç turu tamamlandı', 'Takım güçleri skora işlendi'],
  quiz: ['Soru sonuçlandı', 'Gerçek cevap dağılımı hesaplandı'],
  wheel: ['Ülke oylaması sonuçlandı', 'En yüksek oy çarka taşındı'],
  emoji: ['Emoji şifresi açıldı', 'Doğru tahminler kaydedildi'],
  word: ['Kelime turu sonuçlandı', 'Hızlı cevaplar sıralandı'],
  numbers: ['Sayı kapışması bitti', 'Kazanan taraf belirlendi'],
  pickaxe: ['Maden turu tamamlandı', 'Derinlik, blok ve TNT zinciri hesaplandı'],
  raid: ['Topluluk Raid’i bitti', 'Boss hasarı ve saldırılar hesaplandı'],
  tetris: ['Tetris bölümü tamamlandı', 'Temizlenen satırlar skora işlendi'],
}

const gameIcons: Record<GameId, string> = {
  football: '⚽', quiz: '?', wheel: '🌍', emoji: '🧩', word: 'Aa', numbers: '12', pickaxe: '⛏', raid: '🐉', tetris: '▦',
}

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.')
  return data
}

function readFootballSetup(): FootballSetup {
  try {
    const stored = JSON.parse(window.localStorage.getItem('live-game-animator-football') || '{}')
    const home = teams.find((team) => team.id === stored.home?.id)
    const away = teams.find((team) => team.id === stored.away?.id)
    if (home && away && home.id !== away.id) return { home, away }
  } catch {
    // İlk kullanımda varsayılan derbi açılır.
  }
  return defaultFootballSetup
}

function readGameConfig(): GameConfig {
  try {
    const stored = JSON.parse(window.localStorage.getItem('live-game-animator-games') || '{}')
    const order = Array.isArray(stored.order) ? stored.order.filter((id: GameId) => games.some((game) => game.id === id)) : []
    const completeOrder = [...order, ...games.map((game) => game.id).filter((id) => !order.includes(id))]
    const durations = { ...defaultGameConfig.durations }
    for (const game of games) durations[game.id] = Math.max(10, Math.min(180, Number(stored.durations?.[game.id] || game.duration)))
    return { order: completeOrder, durations }
  } catch {
    return defaultGameConfig
  }
}

function readStreamMetadata(): StreamMetadata {
  const defaults = isEnglish
    ? { title: 'Live Game Arena', description: 'An interactive live stream where comments become gameplay.', tags: 'live stream, interactive game, quiz' }
    : { title: 'Canlı Oyun Arenası', description: 'Yorumların oyuna dönüştüğü interaktif canlı yayın.', tags: 'canlı yayın, interaktif oyun, yarışma' }
  try {
    const stored = JSON.parse(window.localStorage.getItem('live-game-animator-stream-metadata') || '{}')
    return {
      title: String(stored.title || defaults.title),
      description: String(stored.description || defaults.description),
      tags: String(stored.tags || defaults.tags),
    }
  } catch {
    return defaults
  }
}

function buildDemoContext(game: GameId, round: number, footballSetup: FootballSetup, continuous = false) {
  if (game === 'football') return { game, round, continuous, commands: [footballSetup.home.command, footballSetup.away.command] }
  if (game === 'quiz') return { game, round, continuous, commands: ['A', 'B', 'C', 'D'] }
  if (game === 'numbers') return { game, round, continuous, commands: ['1', '2'] }
  if (game === 'pickaxe') return { game, round, continuous, commands: isEnglish ? ['tnt', 'fast', 'slow', 'big', 'wood', 'stone', 'iron', 'gold', 'diamond', 'netherite', 'mega'] : ['tnt', 'hızlı', 'yavaş', 'büyük', 'tahta', 'taş', 'demir', 'altın', 'elmas', 'netherite', 'mega'] }
  if (game === 'raid') return { game, round, continuous, commands: isEnglish ? ['hit', 'heal', 'attack', 'heal', 'hit'] : ['vur', 'iyileş', 'vur', 'iyileş', 'saldır'] }
  if (game === 'tetris') return { game, round, continuous, commands: isEnglish ? ['left', 'right', 'rotate', 'drop', 'left', 'drop'] : ['sol', 'sağ', 'döndür', 'indir', 'sol', 'indir'] }
  if (game === 'wheel') {
    const commands = Array.from({ length: 8 }, (_, index) => countries[(round * 7 + index * 19) % countries.length].name)
    return { game, round, continuous, commands }
  }
  const puzzles = game === 'emoji' ? emojiPuzzles : wordPuzzles
  const answer = puzzles[round % puzzles.length].answer
  const commands = [answer, answer.toLocaleUpperCase(isEnglish ? 'en-US' : 'tr-TR'), `${answer}?`, isEnglish ? `I think ${answer}` : `bence ${answer}`]
  return { game, round, continuous, commands }
}

function commandCorrectness(command: GameCommand, round: number): boolean | null {
  if (command.game === 'quiz') return command.value === questions[round % questions.length].correct
  if (command.game === 'emoji' || command.game === 'word') return command.value === 'correct'
  return null
}

function commandRoundScore(command: GameCommand, message: ChatMessage, round: number) {
  if (command.game === 'raid') return 8 + [...message.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 8
  if (command.game === 'pickaxe') return command.value === 'mega' ? 8 : command.value === 'tnt' ? 5 : 2
  return commandCorrectness(command, round) === true ? 3 : 1
}

function parseNextGameVote(message: string, candidates: NextGameVoteOption[]) {
  const text = normalizeChatText(message)
  if (!text.startsWith('!oy ') && !text.startsWith('oy ')) return null
  const selection = text.replace(/^!?(oy)\s+/, '')
  const numeric = Number(selection)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= candidates.length) return candidates[numeric - 1].id
  return candidates.find((candidate) => normalizeChatText(candidate.id) === selection || normalizeChatText(candidate.name) === selection)?.id || null
}

export default function App() {
  const stageOnly = new URLSearchParams(window.location.search).get('stage') === '1'
  const stageChannel = useRef<BroadcastChannel | null>(null)
  const activitySequence = useRef(10)
  const activeGameRef = useRef<GameId>('football')
  const roundRef = useRef(0)
  const processedMessages = useRef(new Set<string>())
  const roundScores = useRef(new Map<string, { name: string; score: number }>())
  const nextVoteOpenRef = useRef(false)
  const nextVoteOptionsRef = useRef<NextGameVoteOption[]>([])
  const uniqueViewers = useRef(new Set<string>())
  const footballSetupRef = useRef<FootballSetup>(readFootballSetup())

  const [activeGame, setActiveGame] = useState<GameId>('football')
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [round, setRound] = useState(0)
  const [running, setRunning] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [infiniteLoop, setInfiniteLoop] = useState(false)
  const [vertical, setVertical] = useState(true)
  const [remaining, setRemaining] = useState(() => readGameConfig().durations.football)
  const [signals, setSignals] = useState<GameSignals>(createInitialSignals)
  const [activity, setActivity] = useState(initialActivity)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatStatus, setChatStatus] = useState<ChatStatus>(emptyChatStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false)
  const [teamSettingsOpen, setTeamSettingsOpen] = useState(false)
  const [footballSetup, setFootballSetup] = useState<FootballSetup>(readFootballSetup)
  const [draftFootballSetup, setDraftFootballSetup] = useState<FootballSetup>(readFootballSetup)
  const [draftTeamSide, setDraftTeamSide] = useState<'home' | 'away'>('home')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [obs, setObs] = useState<ObsStatus>({ connected: false, streaming: false })
  const [obsUrl, setObsUrl] = useState('ws://127.0.0.1:4455')
  const [obsPassword, setObsPassword] = useState('')
  const [platform, setPlatform] = useState<PlatformId>('youtube')
  const [rtmpServer, setRtmpServer] = useState('rtmps://a.rtmps.youtube.com/live2')
  const [streamKey, setStreamKey] = useState('')
  const [streamMetadata, setStreamMetadata] = useState<StreamMetadata>(readStreamMetadata)
  const [youtubeApiKey, setYoutubeApiKey] = useState('')
  const [youtubeVideo, setYoutubeVideo] = useState('')
  const [busy, setBusy] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('live-game-animator-sound') !== 'off')
  const [soundVolume, setSoundVolume] = useState(() => {
    const saved = Number(window.localStorage.getItem('live-game-animator-volume') || .45)
    return Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : .45
  })
  const [gameConfig, setGameConfig] = useState<GameConfig>(readGameConfig)
  const [draftGameConfig, setDraftGameConfig] = useState<GameConfig>(readGameConfig)
  const [moderation, setModeration] = useState<ModerationSettings>(defaultModeration)
  const [blockedWordsInput, setBlockedWordsInput] = useState('')
  const [webhookSecretInput, setWebhookSecretInput] = useState('')
  const [webhookTitle, setWebhookTitle] = useState('TikTok yorum köprüsü')
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot>(emptyAnalytics)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [nextGameVotes, setNextGameVotes] = useState<Partial<Record<GameId, number>>>({})
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [cosmeticEvent, setCosmeticEvent] = useState<CosmeticEvent | null>(null)
  const [comboNotice, setComboNotice] = useState<ComboNotice | null>(null)

  const orderedGames = useMemo(() => gameConfig.order.map((id) => games.find((game) => game.id === id)).filter(Boolean) as typeof games, [gameConfig.order])
  const game = useMemo(() => {
    const definition = games.find((item) => item.id === activeGame) ?? games[0]
    return { ...definition, duration: gameConfig.durations[definition.id] }
  }, [activeGame, gameConfig.durations])
  const continuousContentCycle = infiniteLoop && (activeGame === 'quiz' || activeGame === 'emoji' || activeGame === 'word')
  const progress = infiniteLoop && !continuousContentCycle ? 100 : Math.max(0, Math.min(100, (remaining / game.duration) * 100))
  const footballCommandHint = `${footballSetup.home.command} veya ${footballSetup.away.command}`
  const commandHintFor = (id: GameId) => id === 'football' ? footballCommandHint : games.find((item) => item.id === id)?.commandHint || ''
  const nextGameCandidates = useMemo(() => {
    const index = orderedGames.findIndex((item) => item.id === activeGame)
    return Array.from({ length: Math.min(3, Math.max(0, orderedGames.length - 1)) }, (_, offset) => orderedGames[(index + offset + 1) % orderedGames.length])
  }, [activeGame, orderedGames])
  const nextVoteOpen = running && autoRotate && !infiniteLoop && remaining <= 8
  const nextVoteOptions = useMemo<NextGameVoteOption[]>(() => nextGameCandidates.map((item) => ({ id: item.id, name: item.shortName, icon: gameIcons[item.id], votes: nextGameVotes[item.id] || 0 })), [nextGameCandidates, nextGameVotes])

  useEffect(() => {
    activeGameRef.current = activeGame
    roundRef.current = round
    footballSetupRef.current = footballSetup
  }, [activeGame, footballSetup, round])

  useEffect(() => {
    nextVoteOpenRef.current = nextVoteOpen
    nextVoteOptionsRef.current = nextVoteOptions
  }, [nextVoteOpen, nextVoteOptions])

  useEffect(() => {
    try {
      window.localStorage.setItem('live-game-animator-football', JSON.stringify(footballSetup))
    } catch {
      // Seçim yine mevcut oturumda çalışmaya devam eder.
    }
  }, [footballSetup])

  useEffect(() => {
    try {
      window.localStorage.setItem('live-game-animator-sound', soundEnabled ? 'on' : 'off')
      window.localStorage.setItem('live-game-animator-volume', String(soundVolume))
      window.localStorage.setItem('live-game-animator-games', JSON.stringify(gameConfig))
    } catch {
      // Tercihler mevcut oturumda çalışmaya devam eder.
    }
  }, [gameConfig, soundEnabled, soundVolume])

  useEffect(() => {
    try {
      window.localStorage.setItem('live-game-animator-stream-metadata', JSON.stringify(streamMetadata))
    } catch {
      // Yayın bilgileri mevcut oturumda kullanılmaya devam eder.
    }
  }, [streamMetadata])

  useEffect(() => {
    if (stageOnly) return
    setSignals((current) => ({
      ...createInitialSignals(),
      totalMessages: current.totalMessages,
      uniqueViewers: current.uniqueViewers,
      lastActor: current.lastActor,
    }))
  }, [round, stageOnly])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('live-game-animator-stage')
    stageChannel.current = channel

    if (stageOnly) {
      const applyState = (state: Partial<{
        activeGame: GameId; round: number; running: boolean; remaining: number; infiniteLoop: boolean; vertical: boolean; signals: GameSignals; footballSetup: FootballSetup; soundEnabled: boolean; soundVolume: number; gameConfig: GameConfig; roundResult: RoundResult | null; cosmeticEvent: CosmeticEvent | null; comboNotice: ComboNotice | null; nextVoteOpen: boolean; nextVoteOptions: NextGameVoteOption[]
      }>) => {
        if (state.activeGame) setActiveGame(state.activeGame)
        if (typeof state.round === 'number') setRound(state.round)
        if (typeof state.running === 'boolean') setRunning(state.running)
        if (typeof state.remaining === 'number') setRemaining(state.remaining)
        if (typeof state.infiniteLoop === 'boolean') setInfiniteLoop(state.infiniteLoop)
        if (typeof state.vertical === 'boolean') setVertical(state.vertical)
        if (state.signals) setSignals(state.signals)
        if (state.footballSetup) setFootballSetup(state.footballSetup)
        if (typeof state.soundEnabled === 'boolean') setSoundEnabled(state.soundEnabled)
        if (typeof state.soundVolume === 'number') setSoundVolume(state.soundVolume)
        if (state.gameConfig) setGameConfig(state.gameConfig)
        if (state.roundResult !== undefined) setRoundResult(state.roundResult)
        if (state.cosmeticEvent !== undefined) setCosmeticEvent(state.cosmeticEvent)
        if (state.comboNotice !== undefined) setComboNotice(state.comboNotice)
        if (typeof state.nextVoteOpen === 'boolean') nextVoteOpenRef.current = state.nextVoteOpen
        if (state.nextVoteOptions) {
          nextVoteOptionsRef.current = state.nextVoteOptions
          setNextGameVotes(Object.fromEntries(state.nextVoteOptions.map((option) => [option.id, option.votes])))
        }
      }
      try {
        const saved = window.localStorage.getItem('live-game-animator-stage')
        if (saved) applyState(JSON.parse(saved))
      } catch {
        // OBS browser sources can still receive live BroadcastChannel updates.
      }
      channel.onmessage = (event) => applyState(event.data)
    }

    return () => {
      channel.close()
      stageChannel.current = null
    }
  }, [stageOnly])

  useEffect(() => {
    if (stageOnly) return
    const state = { activeGame, round, running, remaining, infiniteLoop, vertical, signals, footballSetup, soundEnabled, soundVolume, gameConfig, roundResult, cosmeticEvent, comboNotice, nextVoteOpen, nextVoteOptions }
    try {
      window.localStorage.setItem('live-game-animator-stage', JSON.stringify(state))
    } catch {
      // Cross-tab syncing falls back to BroadcastChannel.
    }
    stageChannel.current?.postMessage(state)
  }, [activeGame, comboNotice, cosmeticEvent, footballSetup, gameConfig, infiniteLoop, nextVoteOpen, nextVoteOptions, remaining, round, roundResult, running, signals, soundEnabled, soundVolume, stageOnly, vertical])

  const handleChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((items) => [message, ...items.filter((item) => item.id !== message.id)].slice(0, 40))
    if (message.replay || processedMessages.current.has(message.id)) return
    processedMessages.current.add(message.id)
    if (processedMessages.current.size > 5000) processedMessages.current.clear()
    uniqueViewers.current.add(message.author.id)

    const currentGame = activeGameRef.current
    const currentRound = roundRef.current
    const nextGameVote = nextVoteOpenRef.current ? parseNextGameVote(message.text, nextVoteOptionsRef.current) : null
    if (nextGameVote) {
      setNextGameVotes((current) => ({ ...current, [nextGameVote]: (current[nextGameVote] || 0) + 1 }))
    }
    const command = nextGameVote ? null : parseGameCommand(currentGame, message.text, currentRound, footballSetupRef.current)
    const canApplyCommand = Boolean(command)
    if (canApplyCommand && command) {
      const score = commandRoundScore(command, message, currentRound)
      const existing = roundScores.current.get(message.author.id)
      roundScores.current.set(message.author.id, { name: message.author.name, score: (existing?.score || 0) + score })
      void api('/api/analytics/command', {
        method: 'POST',
        body: JSON.stringify({
          game: command.game,
          command: String(command.value),
          authorId: message.author.id,
          authorName: message.author.name,
          platform: message.platform,
          isMember: message.author.isMember,
          correct: commandCorrectness(command, currentRound),
        }),
      }).then((result) => {
        if (Array.isArray(result.leaderboard)) setAnalytics((current) => ({ ...current, weeklyLeaderboard: result.leaderboard }))
        if (result.player) setComboNotice({ id: Date.now(), author: result.player.name, combo: result.player.combo, xpGain: result.xpGain || 10 })
      }).catch(() => undefined)
    }

    if (message.amount || message.author.isMember) {
      setCosmeticEvent({
        id: Date.now(),
        author: message.author.name,
        label: message.amount ? `${message.amount} destek` : 'Topluluk üyesi',
        tone: message.amount ? 'supporter' : 'member',
      })
    }

    setSignals((current) => {
      const base = {
        ...current,
        totalMessages: current.totalMessages + 1,
        uniqueViewers: uniqueViewers.current.size,
        lastActor: current.lastActor,
      }
      if (!command || !canApplyCommand) return base
      return applyCommand(base, command, message)
    })

    const chatActivity: ActivityItem = {
      id: Date.now() * 100 + activitySequence.current++,
      kind: 'chat',
      title: `${message.author.name} yorum yaptı`,
      detail: message.text.slice(0, 80),
      time: 'şimdi',
    }
    setActivity((items) => [chatActivity, ...items].slice(0, 6))
  }, [])

  useEffect(() => {
    const source = new EventSource(stageOnly ? '/api/events?role=stage' : '/api/events?role=dashboard')
    if (stageOnly) return () => source.close()
    const onMessage = (event: MessageEvent) => handleChatMessage(JSON.parse(event.data))
    const onStatus = (event: MessageEvent) => {
      const status = JSON.parse(event.data) as ChatStatus
      setChatStatus(status)
      if (status.recentMessages?.length) setChatMessages(status.recentMessages)
    }
    const onModeration = (event: MessageEvent) => {
      const detail = JSON.parse(event.data)
      setNotice({ tone: 'warning', text: `Bir yorum engellendi: ${detail.reason}` })
    }
    source.addEventListener('chat-message', onMessage as EventListener)
    source.addEventListener('chat-status', onStatus as EventListener)
    source.addEventListener('moderation-event', onModeration as EventListener)
    return () => source.close()
  }, [handleChatMessage, stageOnly])

  const pushActivity = useCallback((gameId: GameId, itemRound: number) => {
    const [title, detail] = activityCopy[gameId]
    const nextActivity: ActivityItem = {
      id: Date.now() * 100 + activitySequence.current++, kind: gameId === 'football' ? 'goal' : gameId === 'wheel' ? 'spin' : 'answer',
      title, detail: `${detail} · Tur ${itemRound + 1}`, time: 'şimdi',
    }
    setActivity((items) => [nextActivity, ...items].slice(0, 6))
  }, [])

  const finalizeRound = useCallback((gameId: GameId, itemRound: number) => {
    const winners = [...roundScores.current.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr')).slice(0, 3)
    if (winners.length) {
      const gameName = games.find((item) => item.id === gameId)?.shortName || 'Oyun'
      setRoundResult({ id: Date.now(), title: `${gameName} · Tur ${itemRound + 1}`, winners })
    }
    roundScores.current.clear()
  }, [])

  useEffect(() => {
    if (!running || stageOnly || (infiniteLoop && !continuousContentCycle)) return
    const timer = window.setTimeout(() => {
      if (remaining > 1) return setRemaining(remaining - 1)
      const nextRound = round + 1
      if (infiniteLoop) {
        roundScores.current.clear()
        setRound(nextRound)
        setRemaining(game.duration)
        return
      }
      finalizeRound(activeGame, round)
      setRound(nextRound)
      pushActivity(activeGame, nextRound)
      if (autoRotate) {
        const index = orderedGames.findIndex((item) => item.id === activeGame)
        const voted = nextVoteOptions.filter((option) => option.votes > 0).sort((a, b) => b.votes - a.votes)[0]
        const nextGame = (voted && orderedGames.find((item) => item.id === voted.id)) || orderedGames[(index + 1) % orderedGames.length]
        setActiveGame(nextGame.id)
        setRemaining(gameConfig.durations[nextGame.id])
      } else setRemaining(game.duration)
      setNextGameVotes({})
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [activeGame, autoRotate, continuousContentCycle, finalizeRound, game.duration, gameConfig.durations, infiniteLoop, nextVoteOptions, orderedGames, pushActivity, remaining, round, running, stageOnly])

  useEffect(() => {
    if (!running || stageOnly || activeGame !== 'raid') return
    const boss = raidBosses[round % raidBosses.length]
    const timer = window.setInterval(() => {
      setSignals((current) => {
        const bossDefeated = current.raid.damage >= boss.maxHp
        const communityDefeated = (current.raid.communityHp ?? 250) <= 0
        if (bossDefeated || communityDefeated) return current
        return applyRaidBossAttack(current, boss.name, round)
      })
    }, 4500)
    return () => window.clearInterval(timer)
  }, [activeGame, round, running, stageOnly])

  useEffect(() => {
    if (!running || stageOnly || activeGame !== 'raid' || (signals.raid.communityHp ?? 250) > 0) return
    const boss = raidBosses[round % raidBosses.length]
    if (signals.raid.damage >= boss.maxHp) return
    const timer = window.setTimeout(() => {
      setSignals((current) => reviveRaidCommunity(current))
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [activeGame, round, running, signals.raid.communityHp, signals.raid.damage, stageOnly])

  useEffect(() => {
    if (!running || stageOnly || !infiniteLoop || activeGame !== 'raid') return
    const boss = raidBosses[round % raidBosses.length]
    if (signals.raid.damage < boss.maxHp) return
    const timer = window.setTimeout(() => {
      roundScores.current.clear()
      setRound((value) => value + 1)
      setRemaining(gameConfig.durations.raid)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [activeGame, gameConfig.durations.raid, infiniteLoop, round, running, signals.raid.damage, stageOnly])

  useEffect(() => {
    if (stageOnly) return
    const check = async () => {
      try {
        const [obsResult, chatResult] = await Promise.all([api('/api/obs/status'), api('/api/chat/status')])
        setObs({ connected: obsResult.connected, streaming: Boolean(obsResult.stream?.outputActive) })
        setChatStatus(chatResult)
        setChatMessages(chatResult.recentMessages || [])
      } catch {
        setObs({ connected: false, streaming: false })
      }
    }
    void check()
  }, [stageOnly])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!roundResult) return
    const timer = window.setTimeout(() => setRoundResult(null), 5600)
    return () => window.clearTimeout(timer)
  }, [roundResult])

  useEffect(() => {
    if (!cosmeticEvent) return
    const timer = window.setTimeout(() => setCosmeticEvent(null), 3800)
    return () => window.clearTimeout(timer)
  }, [cosmeticEvent])

  useEffect(() => {
    if (!comboNotice) return
    const timer = window.setTimeout(() => setComboNotice(null), 2400)
    return () => window.clearTimeout(timer)
  }, [comboNotice])

  useEffect(() => {
    if (stageOnly || chatStatus.mode !== 'demo') return
    const context = nextVoteOpen
      ? { game: activeGame, round, commands: nextVoteOptions.map((_, index) => `oy ${index + 1}`) }
      : buildDemoContext(activeGame, round, footballSetup, infiniteLoop)
    void api('/api/chat/demo/context', {
      method: 'POST',
      body: JSON.stringify(context),
    }).catch((error) => setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Demo oyuna bağlanamadı.' }))
  }, [activeGame, chatStatus.mode, footballSetup, infiniteLoop, nextVoteOpen, nextVoteOptions, round, stageOnly])

  const chooseGame = (id: GameId) => {
    const selected = games.find((item) => item.id === id) ?? games[0]
    finalizeRound(activeGameRef.current, roundRef.current)
    if (id !== activeGameRef.current) setInfiniteLoop(false)
    setActiveGame(id)
    setRemaining(gameConfig.durations[selected.id])
    setRound((value) => value + 1)
    setNextGameVotes({})
  }

  const openTeamSettings = () => {
    setDraftFootballSetup(footballSetup)
    setDraftTeamSide('home')
    setTeamSettingsOpen(true)
  }

  const chooseDraftTeam = (team: TeamDefinition) => {
    setDraftFootballSetup((current) => {
      if (draftTeamSide === 'home') {
        return team.id === current.away.id ? { home: team, away: current.home } : { ...current, home: team }
      }
      return team.id === current.home.id ? { home: current.away, away: team } : { ...current, away: team }
    })
  }

  const saveFootballSetup = () => {
    setFootballSetup(draftFootballSetup)
    setRound((value) => value + 1)
    setRemaining(gameConfig.durations.football)
    setTeamSettingsOpen(false)
    setNotice({ tone: 'success', text: `${draftFootballSetup.home.name} - ${draftFootballSetup.away.name} maçı hazır.` })
  }

  const toggleAutomation = async () => {
    if (busy) return
    if (!obs.connected) {
      if (running) setInfiniteLoop(false)
      setRunning((value) => !value)
      setNotice({ tone: 'neutral', text: running ? 'Yerel otomasyon durduruldu.' : 'Yerel otomasyon başladı. Yorumları denemek için Demo modunu açabilirsiniz.' })
      return
    }
    setBusy(true)
    try {
      if (obs.streaming) {
        await api('/api/obs/stream/stop', { method: 'POST' })
        setObs((value) => ({ ...value, streaming: false }))
        setRunning(false)
        setInfiniteLoop(false)
        setNotice({ tone: 'success', text: 'OBS yayını güvenli biçimde durduruldu.' })
      } else {
        if (!streamKey.trim()) {
          setSettingsOpen(true)
          setNotice({ tone: 'warning', text: 'Yayın başlamadan önce RTMP yayın anahtarı gerekli.' })
          return
        }
        await api('/api/obs/destination', { method: 'POST', body: JSON.stringify({ server: rtmpServer, key: streamKey }) })
        await api('/api/obs/stream/start', {
          method: 'POST',
          body: JSON.stringify({
            platform,
            title: streamMetadata.title,
            description: streamMetadata.description,
            tags: streamMetadata.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          }),
        })
        setObs((value) => ({ ...value, streaming: true }))
        setRunning(true)
        setNotice({ tone: 'success', text: `${platform === 'youtube' ? 'YouTube' : 'TikTok'} yayını OBS üzerinden başlatıldı.` })
      }
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Yayın işlemi başarısız oldu.' })
    } finally { setBusy(false) }
  }

  const connectObs = async () => {
    setBusy(true)
    try {
      await api('/api/obs/connect', { method: 'POST', body: JSON.stringify({ url: obsUrl, password: obsPassword }) })
      setObs((value) => ({ ...value, connected: true }))
      setNotice({ tone: 'success', text: 'OBS bağlantısı kuruldu.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'OBS bağlantısı kurulamadı.' })
    } finally { setBusy(false) }
  }

  const disconnectObs = async () => {
    setBusy(true)
    try {
      await api('/api/obs/disconnect', { method: 'POST' })
      setObs({ connected: false, streaming: false })
      setRunning(false)
      setInfiniteLoop(false)
      setNotice({ tone: 'neutral', text: 'OBS bağlantısı kapatıldı.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'OBS bağlantısı kapatılamadı.' })
    } finally { setBusy(false) }
  }

  const connectYoutubeChat = async () => {
    setBusy(true)
    try {
      const status = await api('/api/chat/youtube/connect', { method: 'POST', body: JSON.stringify({ apiKey: youtubeApiKey, videoId: youtubeVideo }) })
      setChatStatus(status)
      setNotice({ tone: 'success', text: 'YouTube canlı yorumları oyun motoruna bağlandı.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'YouTube sohbet bağlantısı kurulamadı.' })
    } finally { setBusy(false) }
  }

  const startDemoChat = async () => {
    try {
      const status = await api('/api/chat/demo/start', { method: 'POST', body: JSON.stringify(buildDemoContext(activeGame, round, footballSetup, infiniteLoop)) })
      setChatStatus(status)
      setNotice({ tone: 'success', text: 'Demo yorumları başladı; oyunlar yorumlara tepki verecek.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Demo yorumları başlatılamadı.' })
    }
  }

  const disconnectChat = async () => {
    try {
      const status = await api('/api/chat/disconnect', { method: 'POST' })
      setChatStatus(status)
      setChatMessages([])
      setNotice({ tone: 'neutral', text: 'Yorum bağlantısı kapatıldı.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Yorum bağlantısı kapatılamadı.' })
    }
  }

  const changePlatform = (next: PlatformId) => {
    setPlatform(next)
    setRtmpServer(next === 'youtube' ? 'rtmps://a.rtmps.youtube.com/live2' : 'rtmps://push-rtmp-f5-va01.tiktokcdn.com/game')
  }

  const copyStreamMetadata = async () => {
    const hashtags = streamMetadata.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => `#${tag.replace(/^#/, '').replace(/\s+/g, '')}`).join(' ')
    const description = streamMetadata.description.includes('github.com/vycdev/falling-pickaxe')
      ? streamMetadata.description.trim()
      : [streamMetadata.description.trim(), fallingPickaxeCredit].filter(Boolean).join('\n\n')
    const text = [streamMetadata.title.trim(), description, hashtags].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setNotice({ tone: 'success', text: `Yayın bilgileri ${platform === 'youtube' ? 'YouTube Studio' : 'TikTok LIVE Center'} için kopyalandı.` })
    } catch {
      setNotice({ tone: 'warning', text: 'Panoya kopyalanamadı; başlık ve açıklamayı elle seçebilirsiniz.' })
    }
  }

  const refreshOperations = useCallback(async () => {
    try {
      const [analyticsResult, diagnosticsResult, moderationResult] = await Promise.all([
        api('/api/analytics'), api('/api/diagnostics'), api('/api/moderation'),
      ])
      setAnalytics({ ...analyticsResult, weeklyLeaderboard: analyticsResult.weeklyLeaderboard || [] })
      setDiagnostics(diagnosticsResult)
      setModeration(moderationResult)
      setBlockedWordsInput(moderationResult.blockedWords.join(', '))
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Operasyon verileri alınamadı.' })
    }
  }, [])

  useEffect(() => {
    if (stageOnly) return
    void refreshOperations()
    const timer = window.setInterval(() => { if (activeView !== 'dashboard') void refreshOperations() }, 15_000)
    return () => window.clearInterval(timer)
  }, [activeView, refreshOperations, stageOnly])

  const saveModeration = async () => {
    try {
      const next = await api('/api/moderation', { method: 'POST', body: JSON.stringify({ ...moderation, blockedWords: blockedWordsInput.split(',').map((word) => word.trim()).filter(Boolean) }) })
      setModeration(next)
      setBlockedWordsInput(next.blockedWords.join(', '))
      setNotice({ tone: 'success', text: 'Moderasyon kuralları kaydedildi.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Moderasyon kaydedilemedi.' })
    }
  }

  const connectWebhookChat = async () => {
    setBusy(true)
    try {
      const status = await api('/api/chat/webhook/connect', { method: 'POST', body: JSON.stringify({ secret: webhookSecretInput, title: webhookTitle, platform: 'tiktok' }) })
      setChatStatus(status)
      setNotice({ tone: 'success', text: 'TikTok/harici yorum webhook köprüsü hazır.' })
    } catch (error) {
      setNotice({ tone: 'warning', text: error instanceof Error ? error.message : 'Webhook köprüsü kurulamadı.' })
    } finally { setBusy(false) }
  }

  const openGameSettings = () => {
    setDraftGameConfig(gameConfig)
    setGameSettingsOpen(true)
  }

  const moveDraftGame = (id: GameId, direction: -1 | 1) => {
    setDraftGameConfig((current) => {
      const index = current.order.indexOf(id)
      const target = index + direction
      if (target < 0 || target >= current.order.length) return current
      const order = [...current.order]
      ;[order[index], order[target]] = [order[target], order[index]]
      return { ...current, order }
    })
  }

  const saveGameConfig = () => {
    setGameConfig(draftGameConfig)
    setRemaining(draftGameConfig.durations[activeGame])
    setGameSettingsOpen(false)
    setNotice({ tone: 'success', text: 'Oyun sırası, süreler ve ses ayarları kaydedildi.' })
  }

  if (stageOnly) return <main className="stage-only-page"><Stage game={activeGame} round={round} running={running} progress={progress} vertical={vertical} signals={signals} footballSetup={footballSetup} soundEnabled={soundEnabled} soundVolume={soundVolume} roundResult={roundResult} cosmeticEvent={cosmeticEvent} comboNotice={comboNotice} nextVoteOpen={nextVoteOpen} nextVoteOptions={nextVoteOptions} continuous={infiniteLoop} clean /></main>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-block"><div className="logo-mark"><span>L</span></div><div><strong>Live Game</strong><small>ANIMATOR</small></div></div>
        <nav className="main-nav" aria-label="Ana menü">
          <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')}><LayoutDashboard size={18} /><span>Kontrol merkezi</span></button>
          <button className={activeView === 'broadcasts' ? 'active' : ''} onClick={() => { setActiveView('broadcasts'); void refreshOperations() }}><MonitorPlay size={18} /><span>Yayınlar</span><em>{analytics.sessions.length}</em></button>
          <button className={activeView === 'analytics' ? 'active' : ''} onClick={() => { setActiveView('analytics'); void refreshOperations() }}><Activity size={18} /><span>Analizler</span></button>
        </nav>
        <div className="sidebar-label">OYUN SAHNELERİ · {games.length}</div>
        <div className="game-menu">
          {orderedGames.map((item, index) => <button className={activeGame === item.id ? 'active' : ''} onClick={() => { chooseGame(item.id); setActiveView('dashboard') }} key={item.id}>
            <span className="game-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.shortName}</strong><small>{commandHintFor(item.id)}</small></div><ChevronRight size={16} />
          </button>)}
        </div>
        <div className="sidebar-leaderboard">
          <div><Trophy size={14} /><span>HAFTALIK LİG</span></div>
          {(analytics.weeklyLeaderboard || []).slice(0, 3).map((player, index) => <div className="sidebar-player" key={player.id}><em>{index + 1}</em><span>{player.name}</span><strong>{player.weeklyXp} XP</strong></div>)}
          {!(analytics.weeklyLeaderboard || []).length && <small>İlk puanları bekliyor</small>}
        </div>
        <div className="sidebar-bottom">
          <div className="safety-card"><ShieldCheck size={18} /><div><strong>Gerçek etkileşim modu</strong><small>Tekrar oy açık · spam beklemesi aktif</small></div></div>
          <button className="settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /> Yayın ayarları</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><div className="eyebrow"><span /> YAYIN KONTROLÜ</div><h1>İyi akşamlar, <em>yayına hazırız.</em></h1></div>
          <div className="topbar-actions">
            <button className="language-switch" onClick={() => switchLanguage(isEnglish ? 'tr' : 'en')} aria-label={isEnglish ? 'Türkçe sürüme geç' : 'Switch to English'}>{isEnglish ? 'TR' : 'EN'}</button>
            <div className={`connection-pill ${chatStatus.connected ? 'connected' : ''}`}><span /> {chatStatus.connected ? `${chatStatus.mode === 'demo' ? 'DEMO' : 'YORUMLAR'} BAĞLI` : 'YORUMLAR KAPALI'}</div>
            <div className={`connection-pill ${obs.connected ? 'connected' : ''}`}><span /> {obs.connected ? 'OBS BAĞLI' : 'OBS BAĞLI DEĞİL'}</div>
            <button className="icon-button" onClick={() => setSoundEnabled((value) => !value)} aria-label={soundEnabled ? 'Yayın seslerini kapat' : 'Yayın seslerini aç'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Ayarları aç"><Settings2 size={19} /></button>
          </div>
        </header>

        {activeView === 'dashboard' && <><section className={`hero-grid ${vertical ? 'portrait-mode' : 'landscape-mode'}`}>
          <div className="preview-panel panel">
            <div className="panel-heading"><div><span className="section-kicker">AKTİF SAHNE</span><h2>{game.name}</h2></div><div className="panel-heading-actions">{activeGame === 'football' && <button className="team-settings-trigger" onClick={openTeamSettings}><Gamepad2 size={14} /> Takımları ayarla</button>}<div className="format-switch"><button className={!vertical ? 'active' : ''} onClick={() => setVertical(false)}>16:9</button><button className={vertical ? 'active' : ''} onClick={() => setVertical(true)}>9:16</button></div></div></div>
            <div className={`preview-frame ${vertical ? 'portrait-preview' : 'landscape-preview'}`}><Stage game={activeGame} round={round} running={running} progress={progress} vertical={vertical} signals={signals} footballSetup={footballSetup} soundEnabled={false} roundResult={roundResult} cosmeticEvent={cosmeticEvent} comboNotice={comboNotice} nextVoteOpen={nextVoteOpen} nextVoteOptions={nextVoteOptions} continuous={infiniteLoop} /></div>
            <div className="preview-controls">
              <div className="next-event"><Clock3 size={17} /><div><small>{infiniteLoop ? 'SONSUZ DÖNGÜ' : 'SONRAKİ SAHNE'}</small><strong>{infiniteLoop ? '∞ · Kesintisiz' : autoRotate ? formatTime(remaining) : 'Manuel mod'}</strong></div></div>
              <button className={`infinite-loop-button ${infiniteLoop ? 'active' : ''}`} aria-pressed={infiniteLoop} onClick={() => {
                const next = !infiniteLoop
                setInfiniteLoop(next)
                setNextGameVotes({})
                if (next) setRoundResult(null)
                setNotice({ tone: 'neutral', text: next ? `${game.shortName} sonsuz döngüye alındı.` : 'Sonsuz döngü kapatıldı.' })
              }}><Repeat2 size={16} /><span><small>ADMİN MODU</small><strong>{infiniteLoop ? 'Döngü açık' : 'Sonsuz döngü'}</strong></span></button>
              <button className={`primary-action ${running ? 'stop' : ''}`} onClick={toggleAutomation} disabled={busy}>{running ? <CircleStop size={18} /> : <Play size={18} fill="currentColor" />}{busy ? 'Bağlanıyor…' : running ? 'Yayını durdur' : obs.connected ? 'Yayını başlat' : 'Otomasyonu dene'}</button>
            </div>
          </div>

          <aside className="right-rail">
            <section className="status-panel panel">
              <div className="rail-heading"><span className="section-kicker">YAYIN DURUMU</span><Radio size={17} /></div>
              <div className={`broadcast-state ${running ? 'on' : ''}`}><span className="state-orb"><i /></span><div><small>OTOMASYON</small><strong>{running ? 'Aktif ve çalışıyor' : 'Başlatılmayı bekliyor'}</strong></div></div>
              <div className="status-list">
                <div><span><Video size={17} /> YouTube yayın</span><em className={obs.streaming && platform === 'youtube' ? 'live' : ''}>{obs.streaming && platform === 'youtube' ? 'Yayında' : 'Hazır'}</em></div>
                <div><span><MessageCircle size={17} /> Yorum motoru</span><em className={chatStatus.connected ? 'ready' : ''}>{chatStatus.connected ? chatStatus.transport === 'stream' ? 'Düşük gecikme' : 'Bağlı' : 'Kapalı'}</em></div>
                <div><span><Bot size={17} /> Oyun motoru</span><em className="ready">{games.length} oyun hazır</em></div>
              </div>
              <button className="rail-action" onClick={() => setSettingsOpen(true)}>Bağlantıları yapılandır <ArrowRight size={15} /></button>
            </section>
            <section className="activity-panel panel">
              <div className="rail-heading"><span className="section-kicker">SON AKTİVİTE</span><Activity size={17} /></div>
              <div className="activity-list">{activity.slice(0, 5).map((item) => <div className="activity-row" key={item.id}><span className={`activity-icon ${item.kind}`}>{item.kind === 'goal' ? <Trophy size={14} /> : item.kind === 'spin' ? <RefreshCw size={14} /> : item.kind === 'chat' ? <MessageCircle size={14} /> : <Zap size={14} />}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time>{item.time}</time></div>)}</div>
            </section>
          </aside>
        </section>

        <section className="chat-console panel">
          <div className="chat-console-head">
            <div><span className="section-kicker">CANLI YORUM MOTORU</span><h2>{chatStatus.connected ? chatStatus.videoTitle || 'Yorum akışı bağlı' : 'Yorum bağlantısı bekleniyor'}</h2></div>
            <div className="chat-stats"><span><MessageCircle size={14} /><strong>{signals.totalMessages}</strong> mesaj</span><span><Users size={14} /><strong>{signals.uniqueViewers}</strong> oyuncu</span><button onClick={() => setSettingsOpen(true)}>{chatStatus.connected ? 'Bağlantıyı yönet' : 'Yorumları bağla'}</button></div>
          </div>
          {chatStatus.error && <div className="inline-error"><AlertCircle size={14} />{chatStatus.error}</div>}
          <div className="chat-body">
            <div className="comment-stream">
              {chatMessages.length ? chatMessages.slice(0, 8).map((message) => <div className={`comment-row ${message.replay ? 'replay' : ''}`} key={message.id}>
                <span className="avatar">{message.author.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>
                <div><div><strong>{message.author.name}</strong>{message.author.isMember && <em>ÜYE</em>}{message.author.isModerator && <em>MOD</em>}{message.amount && <b>{message.amount}</b>}</div><p>{message.text || 'Özel etkinlik'}</p></div>
                <small>{message.replay ? 'geçmiş' : 'yeni'}</small>
              </div>) : <div className="empty-comments"><MessageCircle size={24} /><strong>Henüz yorum yok</strong><p>Test için ayarlardan Demo yorumlarını başlatın.</p></div>}
            </div>
            <div className="command-guide">
              <span className="section-kicker">YORUM KOMUTLARI</span>
              {orderedGames.map((item) => <button onClick={() => chooseGame(item.id)} className={item.id === activeGame ? 'active' : ''} key={item.id}><i>{gameIcons[item.id]}</i><div><strong>{item.shortName}</strong><small>{commandHintFor(item.id)}</small></div></button>)}
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="game-library panel">
            <div className="library-heading"><div><span className="section-kicker">OYUN KÜTÜPHANESİ</span><h2>{games.length} sahneli rotasyon</h2></div><div className="library-actions"><button onClick={openGameSettings}><Settings2 size={14} /> Oyunları düzenle</button><label className="toggle-row"><span>Otomatik geçiş</span><input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} /><i /></label></div></div>
            <div className="library-cards">{orderedGames.map((item, index) => <button className={`library-card ${activeGame === item.id ? 'active' : ''}`} onClick={() => chooseGame(item.id)} key={item.id}><span className="library-number">{String(index + 1).padStart(2, '0')}</span><div className={`mini-art ${item.id}`}><span>{gameIcons[item.id]}</span></div><div><strong>{item.shortName}</strong><small>{gameConfig.durations[item.id]} sn · {commandHintFor(item.id)}</small></div>{activeGame === item.id && <em>AKTİF</em>}</button>)}</div>
          </div>
          <div className="metric-card panel"><div className="metric-icon"><Eye size={20} /></div><div><small>ETKİLEŞİM</small><strong>{signals.totalMessages}</strong><span><Sparkles size={13} /> Tekil oyuncu: {signals.uniqueViewers}</span></div></div>
        </section></>}
        {activeView === 'broadcasts' && <BroadcastsView analytics={analytics} diagnostics={diagnostics} destinationReady={Boolean(rtmpServer.trim() && streamKey.trim())} destinationLabel={platform === 'youtube' ? 'YouTube' : 'TikTok'} metadataReady={Boolean(streamMetadata.title.trim())} onRefresh={() => void refreshOperations()} />}
        {activeView === 'analytics' && <AnalyticsView analytics={analytics} diagnostics={diagnostics} onRefresh={() => void refreshOperations()} />}
      </main>

      {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSettingsOpen(false) }}>
        <section className="settings-modal wide" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header><div><span className="section-kicker">YAYIN KURULUMU</span><h2 id="settings-title">OBS, RTMP ve canlı yorumlar</h2></div><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button></header>
          <div className="settings-note"><ShieldCheck size={19} /><p>OBS parolası, yayın anahtarı ve YouTube API anahtarı yalnızca çalışan uygulama belleğinde tutulur; dosyaya veya tarayıcı depolamasına yazılmaz.</p></div>
          <div className="settings-columns">
            <div>
              <div className="settings-section"><div className="settings-section-title"><span>1</span><div><strong>OBS WebSocket</strong><small>Yayın motorunu başlatır ve durdurur</small></div></div><label>WebSocket adresi<input value={obsUrl} onChange={(event) => setObsUrl(event.target.value)} /></label><label>OBS parolası<input type="password" value={obsPassword} onChange={(event) => setObsPassword(event.target.value)} placeholder="••••••••" /></label>{obs.connected ? <button className="disconnect-button" onClick={disconnectObs} disabled={busy}><CircleStop size={16} /> OBS bağlantısını kes</button> : <button className="connect-button" onClick={connectObs} disabled={busy}><Zap size={16} /> OBS’ye bağlan</button>}</div>
              <div className="settings-section">
                <div className="settings-section-title"><span>2</span><div><strong>Yayın hedefi ve bilgileri</strong><small>OBS görüntüsü ile platformda kullanacağınız yayın metinleri</small></div></div>
                <div className="platform-tabs"><button className={platform === 'youtube' ? 'active' : ''} onClick={() => changePlatform('youtube')}><Video size={17} /> YouTube</button><button className={platform === 'tiktok' ? 'active' : ''} onClick={() => changePlatform('tiktok')}><span>♪</span> TikTok</button></div>
                <label>Yayın başlığı<input maxLength={140} value={streamMetadata.title} onChange={(event) => setStreamMetadata((value) => ({ ...value, title: event.target.value }))} placeholder="Canlı yayın başlığı" /></label>
                <label>Açıklama<textarea maxLength={2000} rows={4} value={streamMetadata.description} onChange={(event) => setStreamMetadata((value) => ({ ...value, description: event.target.value }))} placeholder="Yayının içeriğini anlatın" /></label>
                <label>Etiketler<input value={streamMetadata.tags} onChange={(event) => setStreamMetadata((value) => ({ ...value, tags: event.target.value }))} placeholder="oyun, canlı yayın, yarışma" /></label>
                <button className="metadata-copy-button" onClick={() => void copyStreamMetadata()}><ClipboardCopy size={15} /> YouTube/TikTok için metni kopyala</button>
                <p className="platform-note"><AlertCircle size={14} /> RTMP yalnızca görüntü ve sesi taşır. Başlık, açıklama ve etiketleri {platform === 'youtube' ? 'YouTube Studio' : 'TikTok LIVE Center'} ekranına yapıştırın; bilgiler ayrıca yayın geçmişinde saklanır.</p>
                <label>RTMP(S) sunucusu<input value={rtmpServer} onChange={(event) => setRtmpServer(event.target.value)} /></label>
                <label>Yayın anahtarı<div className="key-input"><KeyRound size={16} /><input type="password" value={streamKey} onChange={(event) => setStreamKey(event.target.value)} placeholder="Yayın anahtarını yapıştırın" /></div></label>
              </div>
            </div>
            <div>
              <div className="settings-section chat-settings"><div className="settings-section-title"><span>3</span><div><strong>YouTube canlı yorumları</strong><small>Gerçek yorumları oyun komutlarına dönüştürür</small></div></div><label>YouTube Data API anahtarı<input type="password" value={youtubeApiKey} onChange={(event) => setYoutubeApiKey(event.target.value)} placeholder="AIza…" /></label><label>Canlı yayın bağlantısı veya Video ID<input value={youtubeVideo} onChange={(event) => setYoutubeVideo(event.target.value)} placeholder="https://youtube.com/watch?v=…" /></label>{chatStatus.connected ? <button className="disconnect-button" onClick={disconnectChat}><CircleStop size={16} /> {chatStatus.mode === 'demo' ? 'Demo yorumlarını durdur' : 'Yorum bağlantısını kes'}</button> : <button className="connect-button" onClick={connectYoutubeChat} disabled={busy}><MessageCircle size={16} /> YouTube yorumlarını bağla</button>}<div className="or-divider"><span>veya</span></div><button className="demo-button" onClick={startDemoChat} disabled={chatStatus.mode === 'demo'}><Play size={15} /> Demo yorumlarını başlat</button><p className="settings-help"><AlertCircle size={14} /> API anahtarı yayın anahtarından farklıdır. Google Cloud’da YouTube Data API v3 etkinleştirilerek alınır. İlk bağlantıda geçmiş mesajlar görünür fakat oy sayılmaz.</p></div>
              <div className="settings-section compact-settings">
                <div className="settings-section-title"><span>4</span><div><strong>TikTok / harici yorum köprüsü</strong><small>Desteklenen bir yorum sağlayıcısını güvenli webhook ile bağlar</small></div></div>
                <label>Köprü adı<input value={webhookTitle} onChange={(event) => setWebhookTitle(event.target.value)} placeholder="TikTok canlı yayını" /></label>
                <label>Gizli erişim anahtarı<input type="password" value={webhookSecretInput} onChange={(event) => setWebhookSecretInput(event.target.value)} placeholder="En az 12 karakter" /></label>
                <button className="connect-button" onClick={connectWebhookChat} disabled={busy || webhookSecretInput.length < 12}><Zap size={16} /> Webhook köprüsünü hazırla</button>
                <div className="webhook-endpoint"><small>POST uç noktası</small><code>http://127.0.0.1:5173/api/chat/webhook/message</code><p><code>Authorization: Bearer ERİŞİM_ANAHTARI</code></p></div>
                <p className="settings-help"><AlertCircle size={14} /> TikTok doğrudan canlı yorum API’si sunmadığı için üçüncü taraf sağlayıcı veya kendi bağlayıcınız bu uç noktaya JSON mesajı gönderir.</p>
              </div>
              <div className="settings-section compact-settings">
                <div className="settings-section-title"><span>5</span><div><strong>Yorum moderasyonu</strong><small>Spam, tekrar ve sakıncalı içerikleri oyunlardan uzak tutar</small></div></div>
                <label className="moderation-check"><input type="checkbox" checked={moderation.enabled} onChange={(event) => setModeration((value) => ({ ...value, enabled: event.target.checked }))} /> Otomatik moderasyon açık</label>
                <label>Engelli kelimeler<input value={blockedWordsInput} onChange={(event) => setBlockedWordsInput(event.target.value)} placeholder="virgülle ayırın" /></label>
                <div className="moderation-grid">
                  <label>Kullanıcı bekleme süresi (ms)<input type="number" min="0" max="10000" value={moderation.cooldownMs} onChange={(event) => setModeration((value) => ({ ...value, cooldownMs: Number(event.target.value) }))} /></label>
                  <label>Azami mesaj uzunluğu<input type="number" min="20" max="500" value={moderation.maxMessageLength} onChange={(event) => setModeration((value) => ({ ...value, maxMessageLength: Number(event.target.value) }))} /></label>
                </div>
                <button className="demo-button" onClick={() => void saveModeration()}><ShieldCheck size={16} /> Moderasyonu kaydet</button>
              </div>
              <div className="browser-source-card"><Gamepad2 size={19} /><div><strong>OBS Tarayıcı Kaynağı</strong><code>{`${window.location.origin}/?stage=1${isEnglish ? '&lang=en' : ''}`}</code></div></div>
            </div>
          </div>
          <footer><button className="ghost-button" onClick={() => setSettingsOpen(false)}>Kapat</button><button className="save-button" onClick={() => { setSettingsOpen(false); setNotice({ tone: 'success', text: 'Yayın ve yorum ayarları hazır.' }) }}><Check size={16} /> Ayarları kullan</button></footer>
        </section>
      </div>}
      {gameSettingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setGameSettingsOpen(false) }}>
        <section className="settings-modal game-settings-modal" role="dialog" aria-modal="true" aria-labelledby="game-settings-title">
          <header><div><span className="section-kicker">ROTASYON YÖNETİMİ</span><h2 id="game-settings-title">Oyun sırası ve yayın temposu</h2></div><button className="modal-close" onClick={() => setGameSettingsOpen(false)}>×</button></header>
          <div className="game-config-summary">
            <div><strong>{games.length} oyun</strong><small>Kesintisiz otomatik rotasyon</small></div>
            <div><strong>{questions.length}</strong><small>Bilgi sorusu</small></div>
            <div><strong>{emojiPuzzles.length}</strong><small>Emoji bulmacası</small></div>
            <div><strong>{wordPuzzles.length}</strong><small>Kelime</small></div>
          </div>
          <div className="game-config-list">
            {draftGameConfig.order.map((id, index) => {
              const item = games.find((game) => game.id === id)!
              return <div className="game-config-row" key={id}>
                <span className={`game-config-icon ${id}`}>{gameIcons[id]}</span>
                <div><strong>{index + 1}. {item.name}</strong><small>{commandHintFor(id)}</small></div>
                <label>Süre<input type="number" min="10" max="180" value={draftGameConfig.durations[id]} onChange={(event) => setDraftGameConfig((value) => ({ ...value, durations: { ...value.durations, [id]: Math.max(10, Math.min(180, Number(event.target.value) || 10)) } }))} /><em>sn</em></label>
                <div className="order-buttons"><button onClick={() => moveDraftGame(id, -1)} disabled={index === 0} aria-label={`${item.name} yukarı`}>↑</button><button onClick={() => moveDraftGame(id, 1)} disabled={index === draftGameConfig.order.length - 1} aria-label={`${item.name} aşağı`}>↓</button></div>
              </div>
            })}
          </div>
          <div className="sound-config">
            <div><Volume2 size={18} /><span><strong>Yayın ses efektleri</strong><small>Gol, tur, çark ve kazanan anlarını vurgular</small></span></div>
            <label className="toggle-row"><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /><i /></label>
            <label className="volume-slider">Ses düzeyi<input type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(event) => setSoundVolume(Number(event.target.value))} /><strong>%{Math.round(soundVolume * 100)}</strong></label>
          </div>
          <footer><button className="ghost-button" onClick={() => setGameSettingsOpen(false)}>İptal</button><button className="save-button" onClick={saveGameConfig}><Check size={16} /> Rotasyonu kaydet</button></footer>
        </section>
      </div>}
      {teamSettingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setTeamSettingsOpen(false) }}>
        <section className="settings-modal team-settings-modal" role="dialog" aria-modal="true" aria-labelledby="team-settings-title">
          <header><div><span className="section-kicker">HALI SAHA KURULUMU</span><h2 id="team-settings-title">Büyük maçı oluştur</h2></div><button className="modal-close" onClick={() => setTeamSettingsOpen(false)}>×</button></header>
          <div className="fixture-preview">
            {(['home', 'away'] as const).map((side) => { const team = draftFootballSetup[side]; return <button className={draftTeamSide === side ? 'active' : ''} onClick={() => setDraftTeamSide(side)} key={side}><span className="fixture-side">{side === 'home' ? 'EV SAHİBİ' : 'DEPLASMAN'}</span><span className="team-crest-large" style={{ '--team-primary': team.colors[0], '--team-secondary': team.colors[1] } as React.CSSProperties}>{team.crest}</span><strong>{team.name}</strong><small>{team.command}</small></button> })}
            <em>VS</em>
          </div>
          <div className="team-picker-head"><div><strong>{draftTeamSide === 'home' ? 'Ev sahibini seç' : 'Deplasman takımını seç'}</strong><small>Takım kartına dokun; aynı takım seçilirse taraflar yer değiştirir.</small></div><span>{teams.length} TAKIM</span></div>
          <div className="team-grid">{teams.map((team) => {
            const selected = draftFootballSetup[draftTeamSide].id === team.id
            return <button className={selected ? 'selected' : ''} onClick={() => chooseDraftTeam(team)} key={team.id}><span className="team-picker-crest" style={{ '--team-primary': team.colors[0], '--team-secondary': team.colors[1] } as React.CSSProperties}>{team.crest}</span><div><strong>{team.name}</strong><small>{team.league} · {team.command}</small></div>{selected && <Check size={15} />}</button>
          })}</div>
          <footer><button className="ghost-button" onClick={() => setTeamSettingsOpen(false)}>İptal</button><button className="save-button" onClick={saveFootballSetup}><Check size={16} /> Maçı hazırla</button></footer>
        </section>
      </div>}
      {notice && <div className={`toast ${notice.tone}`}>{notice.tone === 'warning' ? <AlertCircle size={17} /> : <Check size={17} />}{notice.text}</div>}
    </div>
  )
}
