import { countries, defaultFootballSetup, emojiPuzzles, wordPuzzles } from './data'
import type { ChatMessage, FootballSetup, GameId, GameSignals } from './types'

export type GameCommand =
  | { game: 'football'; value: 'home' | 'away' }
  | { game: 'quiz'; value: 0 | 1 | 2 | 3 }
  | { game: 'wheel'; value: string }
  | { game: 'emoji'; value: 'attempt' | 'correct' }
  | { game: 'word'; value: 'attempt' | 'correct' }
  | { game: 'numbers'; value: 'one' | 'two' }
  | { game: 'pickaxe'; value: 'tnt' | 'mega' | 'fast' | 'slow' | 'big' | 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite' }
  | { game: 'raid'; value: 'hit' | 'heal' }
  | { game: 'tetris'; value: 'left' | 'right' | 'rotate' | 'drop' }

export const RAID_COMMUNITY_MAX_HP = 250

export function normalizeChatText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}! ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseGameCommand(game: GameId, message: string, round: number, setup: FootballSetup = defaultFootballSetup): GameCommand | null {
  const text = normalizeChatText(message)
  if (!text) return null
  const commandText = text.replace(/^!+\s*/, '')

  if (game === 'football') {
    const tokens = (team: FootballSetup['home'], side: 'home' | 'away') => [
      team.command, team.id, team.shortName, team.name, side === 'home' ? '1' : '2',
    ].map(normalizeChatText).map((value) => value.replace(/^!+\s*/, ''))
    if (tokens(setup.home, 'home').includes(commandText)) return { game, value: 'home' }
    if (tokens(setup.away, 'away').includes(commandText)) return { game, value: 'away' }
  }

  if (game === 'quiz') {
    const answer = commandText
    const index = ['a', 'b', 'c', 'd'].indexOf(answer)
    if (index >= 0) return { game, value: index as 0 | 1 | 2 | 3 }
  }

  if (game === 'wheel') {
    const country = countries.find((item) => item.aliases.some((alias) => normalizeChatText(alias) === commandText))
    if (country) return { game, value: country.name }
  }

  if (game === 'emoji') {
    const puzzle = emojiPuzzles[round % emojiPuzzles.length]
    return { game, value: commandText === normalizeChatText(puzzle.answer) ? 'correct' : 'attempt' }
  }

  if (game === 'word') {
    const puzzle = wordPuzzles[round % wordPuzzles.length]
    return { game, value: commandText === normalizeChatText(puzzle.answer) ? 'correct' : 'attempt' }
  }

  if (game === 'numbers') {
    if (commandText === '1' || commandText === 'bir') return { game, value: 'one' }
    if (commandText === '2' || commandText === 'iki') return { game, value: 'two' }
  }

  if (game === 'pickaxe') {
    if (['tnt', 'bomba'].includes(commandText)) return { game, value: 'tnt' }
    if (['mega', 'mega tnt', 'megatnt'].includes(commandText)) return { game, value: 'mega' }
    if (['fast', 'hizli', 'hızlı'].includes(commandText)) return { game, value: 'fast' }
    if (['slow', 'yavas', 'yavaş'].includes(commandText)) return { game, value: 'slow' }
    if (['big', 'buyuk', 'büyük'].includes(commandText)) return { game, value: 'big' }
    if (['wood', 'tahta', 'ahsap', 'ahşap'].includes(commandText)) return { game, value: 'wood' }
    if (['stone', 'tas', 'taş'].includes(commandText)) return { game, value: 'stone' }
    if (['iron', 'demir'].includes(commandText)) return { game, value: 'iron' }
    if (['gold', 'altin', 'altın'].includes(commandText)) return { game, value: 'gold' }
    if (['diamond', 'elmas'].includes(commandText)) return { game, value: 'diamond' }
    if (['netherite', 'netherit'].includes(commandText)) return { game, value: 'netherite' }
  }

  if (game === 'raid') {
    if (['vur', 'saldir', 'saldır'].includes(commandText)) return { game, value: 'hit' }
    if (['iyiles', 'iyileş', 'iyilestir', 'heal', 'can'].includes(commandText)) return { game, value: 'heal' }
  }

  if (game === 'tetris') {
    if (['sol', 'left'].includes(commandText)) return { game, value: 'left' }
    if (['sag', 'sağ', 'right'].includes(commandText)) return { game, value: 'right' }
    if (['dondur', 'döndür', 'cevir', 'çevir', 'rotate'].includes(commandText)) return { game, value: 'rotate' }
    if (['indir', 'birak', 'bırak', 'drop'].includes(commandText)) return { game, value: 'drop' }
  }

  return null
}

export function applyCommand(signals: GameSignals, command: GameCommand, message: ChatMessage): GameSignals {
  const next: GameSignals = {
    ...signals,
    lastActor: message.author.name,
    football: { ...signals.football },
    quiz: [...signals.quiz],
    wheel: { ...signals.wheel },
    emoji: { ...signals.emoji, winners: [...signals.emoji.winners] },
    word: { ...signals.word, winners: [...signals.word.winners] },
    numbers: { ...signals.numbers },
    tetris: { ...signals.tetris },
    pickaxe: { ...signals.pickaxe },
    raid: { ...signals.raid },
  }

  if (command.game === 'football') next.football[command.value] += 1
  if (command.game === 'quiz') next.quiz[command.value] += 1
  if (command.game === 'wheel') next.wheel[command.value] = (next.wheel[command.value] || 0) + 1
  if (command.game === 'emoji') {
    next.emoji.attempts += 1
    if (command.value === 'correct' && !next.emoji.winners.includes(message.author.name)) next.emoji.winners.push(message.author.name)
  }
  if (command.game === 'word') {
    next.word.attempts += 1
    if (command.value === 'correct' && !next.word.winners.includes(message.author.name)) next.word.winners.push(message.author.name)
  }
  if (command.game === 'numbers') next.numbers[command.value] += 1
  if (command.game === 'tetris') {
    next.tetris.actionSeq += 1
    next.tetris.commands += 1
    next.tetris.lastAction = command.value
  }
  if (command.game === 'pickaxe') {
    next.pickaxe.combo += 1
    if (command.value === 'fast' || command.value === 'slow') {
      next.pickaxe.speed = command.value
      next.pickaxe.lastAction = command.value
    } else if (command.value === 'big') {
      next.pickaxe.bigHits += 1
      next.pickaxe.lastAction = 'big'
    } else if (['wood', 'stone', 'iron', 'gold', 'diamond', 'netherite'].includes(command.value)) {
      next.pickaxe.tier = command.value as GameSignals['pickaxe']['tier']
      next.pickaxe.lastAction = 'tier'
    } else if (command.value === 'mega') {
      next.pickaxe.megaTnt += 1
      next.pickaxe.lastAction = 'mega'
    } else {
      next.pickaxe.tnt += 1
      next.pickaxe.lastAction = 'tnt'
    }
  }
  if (command.game === 'raid') {
    const seed = [...message.id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
    if (command.value === 'hit') {
      const communityAlive = (next.raid.communityHp ?? RAID_COMMUNITY_MAX_HP) > 0
      if (communityAlive) {
        const damage = 8 + seed % 8
        next.raid.damage += damage
        next.raid.hits += 1
        next.raid.lastDamage = damage
        next.raid.lastAction = 'hit'
      }
    } else {
      const currentHp = next.raid.communityHp ?? RAID_COMMUNITY_MAX_HP
      const heal = Math.min(16 + seed % 13, Math.max(0, RAID_COMMUNITY_MAX_HP - currentHp))
      next.raid.communityHp = Math.min(RAID_COMMUNITY_MAX_HP, currentHp + heal)
      next.raid.heals = (next.raid.heals ?? 0) + 1
      next.raid.healing = (next.raid.healing ?? 0) + heal
      next.raid.lastHeal = heal
      next.raid.lastAction = 'heal'
    }
  }
  return next
}

export function applyRaidBossAttack(signals: GameSignals, bossName: string, round: number): GameSignals {
  const currentHp = signals.raid.communityHp ?? RAID_COMMUNITY_MAX_HP
  if (currentHp <= 0) return signals
  const attackNumber = (signals.raid.bossAttacks ?? 0) + 1
  const damage = 28 + (round * 11 + attackNumber * 7) % 15
  return {
    ...signals,
    lastActor: bossName,
    raid: {
      ...signals.raid,
      communityHp: Math.max(0, currentHp - damage),
      bossAttacks: attackNumber,
      lastBossDamage: damage,
      lastAction: 'boss',
    },
  }
}

export function reviveRaidCommunity(signals: GameSignals): GameSignals {
  const currentHp = signals.raid.communityHp ?? RAID_COMMUNITY_MAX_HP
  if (currentHp > 0) return signals
  return {
    ...signals,
    lastActor: 'Topluluk',
    raid: {
      ...signals.raid,
      communityHp: RAID_COMMUNITY_MAX_HP,
      lastHeal: 0,
      lastBossDamage: 0,
      lastAction: 'revive',
    },
  }
}
