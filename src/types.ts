export type GameId = 'football' | 'quiz' | 'wheel' | 'emoji' | 'word' | 'numbers' | 'pickaxe' | 'raid' | 'tetris'
export type PlatformId = 'youtube' | 'tiktok'

export type TeamDefinition = {
  id: string
  name: string
  shortName: string
  command: string
  colors: [string, string]
  crest: string
  league: string
}

export type FootballSetup = {
  home: TeamDefinition
  away: TeamDefinition
}

export type GameDefinition = {
  id: GameId
  name: string
  shortName: string
  description: string
  commandHint: string
  accent: string
  duration: number
}

export type ActivityItem = {
  id: number
  kind: 'system' | 'goal' | 'answer' | 'spin' | 'chat'
  title: string
  detail: string
  time: string
}

export type ChatMessage = {
  id: string
  platform: 'youtube' | 'demo' | 'tiktok' | 'webhook'
  kind: string
  text: string
  publishedAt: string
  replay: boolean
  amount: string | null
  author: {
    id: string
    name: string
    avatar: string | null
    isOwner: boolean
    isModerator: boolean
    isMember: boolean
  }
}

export type ChatStatus = {
  mode: 'off' | 'youtube' | 'demo' | 'webhook'
  connected: boolean
  platform: 'youtube' | 'demo' | 'tiktok' | 'webhook' | null
  videoId: string | null
  videoTitle: string | null
  pollIntervalMs: number | null
  transport?: 'stream' | 'polling' | null
  lastMessageAt: string | null
  error: string | null
  messageCount: number
  recentMessages: ChatMessage[]
}

export type ModerationSettings = {
  enabled: boolean
  blockedWords: string[]
  cooldownMs: number
  maxMessageLength: number
}

export type AnalyticsSnapshot = {
  createdAt: string
  updatedAt: string
  stats: {
    totalMessages: number
    acceptedMessages: number
    blockedMessages: number
    acceptedCommands: number
    uniqueAuthors: number
    byPlatform: Record<string, number>
    byGame: Record<string, number>
  }
  sessions: Array<{ id: string; platform: string; title?: string; description?: string; tags?: string[]; startedAt: string; endedAt: string | null; status: string }>
  events: Array<{ id: string; type: string; detail: Record<string, unknown>; at: string }>
  weeklyLeaderboard: PlayerProfile[]
}

export type PlayerProfile = {
  id: string
  name: string
  platform: string
  xp: number
  level: number
  weeklyXp: number
  commands: number
  correctAnswers: number
  combo: number
  bestCombo: number
  isMember: boolean
  lastSeenAt: string
}

export type RoundResult = { id: number; title: string; winners: Array<{ name: string; score: number }> }
export type CosmeticEvent = { id: number; author: string; label: string; tone: 'member' | 'supporter' }
export type ComboNotice = { id: number; author: string; combo: number; xpGain: number }
export type NextGameVoteOption = { id: GameId; name: string; icon: string; votes: number }

export type GameSignals = {
  totalMessages: number
  uniqueViewers: number
  lastActor: string | null
  football: { home: number; away: number }
  quiz: [number, number, number, number]
  wheel: Record<string, number>
  emoji: { attempts: number; winners: string[] }
  word: { attempts: number; winners: string[] }
  numbers: { one: number; two: number }
  tetris: { actionSeq: number; commands: number; lastAction: 'left' | 'right' | 'rotate' | 'drop' | null }
  pickaxe: {
    depth: number
    mined: number
    combo: number
    energy: number
    lane: number
    tnt: number
    megaTnt: number
    tier: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite'
    speed: 'slow' | 'normal' | 'fast'
    bigHits: number
    blockDamage: number
    lastOre: 'coal' | 'copper' | 'iron' | 'gold' | 'crystal' | 'emerald' | null
    ores: { coal: number; copper: number; iron: number; gold: number; crystal: number; emerald: number }
    lastGain: number
    lastAction: 'tnt' | 'mega' | 'fast' | 'slow' | 'big' | 'tier' | null
  }
  raid: {
    damage: number
    hits: number
    lastDamage: number
    communityHp: number
    heals: number
    healing: number
    lastHeal: number
    bossAttacks: number
    lastBossDamage: number
    lastAction: 'hit' | 'heal' | 'boss' | 'revive' | null
  }
}
