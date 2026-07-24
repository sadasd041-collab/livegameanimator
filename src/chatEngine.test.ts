import { describe, expect, it } from 'vitest'
import { applyCommand, applyRaidBossAttack, parseGameCommand, RAID_COMMUNITY_MAX_HP, reviveRaidCommunity } from './chatEngine'
import { countries, createInitialSignals, emojiPuzzles, questions, teams, wordPuzzles } from './data'

describe('chat command parser', () => {
  it('accepts commands with or without a leading exclamation mark in every game', () => {
    const cases = [
      ['football', 'gs', '!gs'],
      ['quiz', 'c', '!c'],
      ['wheel', 'Türkiye', '!Türkiye'],
      ['emoji', 'gökkuşağı', '!gökkuşağı'],
      ['word', 'kamera', '!kamera'],
      ['numbers', '2', '!2'],
      ['pickaxe', 'tnt', '!tnt'],
      ['raid', 'vur', '!vur'],
      ['tetris', 'döndür', '!döndür'],
    ] as const
    for (const [game, plain, marked] of cases) {
      expect(parseGameCommand(game, plain, 0)).toEqual(parseGameCommand(game, marked, 0))
      expect(parseGameCommand(game, plain, 0)).not.toBeNull()
    }
  })

  it('parses team, quiz, country and number votes', () => {
    expect(parseGameCommand('football', '!GS', 0)).toEqual({ game: 'football', value: 'home' })
    expect(parseGameCommand('football', '!fb', 0)).toEqual({ game: 'football', value: 'away' })
    expect(parseGameCommand('quiz', ' c ', 0)).toEqual({ game: 'quiz', value: 2 })
    expect(parseGameCommand('wheel', 'Türkiye 🇹🇷', 0)).toEqual({ game: 'wheel', value: 'Türkiye' })
    expect(parseGameCommand('numbers', '2', 0)).toEqual({ game: 'numbers', value: 'two' })
    expect(parseGameCommand('pickaxe', '!KAZ', 0)).toBeNull()
    expect(parseGameCommand('pickaxe', '!SAĞ', 0)).toBeNull()
    expect(parseGameCommand('pickaxe', 'TNT', 0)).toEqual({ game: 'pickaxe', value: 'tnt' })
    expect(parseGameCommand('pickaxe', 'hızlı', 0)).toEqual({ game: 'pickaxe', value: 'fast' })
    expect(parseGameCommand('pickaxe', 'büyük', 0)).toEqual({ game: 'pickaxe', value: 'big' })
    expect(parseGameCommand('pickaxe', 'elmas', 0)).toEqual({ game: 'pickaxe', value: 'diamond' })
    expect(parseGameCommand('raid', '!VUR', 0)).toEqual({ game: 'raid', value: 'hit' })
    expect(parseGameCommand('raid', '!İYİLEŞ', 0)).toEqual({ game: 'raid', value: 'heal' })
    expect(parseGameCommand('tetris', 'sol', 0)).toEqual({ game: 'tetris', value: 'left' })
    expect(parseGameCommand('tetris', '!SAĞ', 0)).toEqual({ game: 'tetris', value: 'right' })
    expect(parseGameCommand('tetris', 'döndür', 0)).toEqual({ game: 'tetris', value: 'rotate' })
    expect(parseGameCommand('tetris', 'indir', 0)).toEqual({ game: 'tetris', value: 'drop' })
  })

  it('queues every community Tetris move as a distinct action', () => {
    const message = { id: 'tetris-1', platform: 'youtube' as const, kind: 'textMessageEvent', text: 'sol', publishedAt: new Date().toISOString(), replay: false, amount: null, author: { id: 'player-1', name: 'Oyuncu', avatar: null, isOwner: false, isModerator: false, isMember: false } }
    const moved = applyCommand(createInitialSignals(), { game: 'tetris', value: 'left' }, message)
    const dropped = applyCommand(moved, { game: 'tetris', value: 'drop' }, { ...message, id: 'tetris-2' })
    expect(dropped.tetris).toEqual({ actionSeq: 2, commands: 2, lastAction: 'drop' })
    expect(dropped.lastActor).toBe('Oyuncu')
  })

  it('queues falling-pickaxe events without faking physics progress', () => {
    const message = { id: 'mine-1', platform: 'youtube' as const, kind: 'textMessageEvent', text: 'tnt', publishedAt: new Date().toISOString(), replay: false, amount: null, author: { id: 'miner-1', name: 'Madenci', avatar: null, isOwner: false, isModerator: false, isMember: false } }
    const initial = createInitialSignals()
    const exploded = applyCommand(initial, { game: 'pickaxe', value: 'tnt' }, message)
    expect(exploded.pickaxe.tnt).toBe(1)
    expect(exploded.pickaxe.combo).toBe(1)
    expect(exploded.pickaxe.depth).toBe(0)
    expect(exploded.pickaxe.mined).toBe(0)
    expect(exploded.pickaxe.lastAction).toBe('tnt')

    const spedUp = applyCommand(exploded, { game: 'pickaxe', value: 'fast' }, { ...message, id: 'mine-2' })
    expect(spedUp.pickaxe.speed).toBe('fast')
    expect(spedUp.pickaxe.combo).toBe(2)
    const upgraded = applyCommand(spedUp, { game: 'pickaxe', value: 'diamond' }, { ...message, id: 'mine-3' })
    expect(upgraded.pickaxe.tier).toBe('diamond')
    expect(upgraded.pickaxe.lastAction).toBe('tier')
    const enlarged = applyCommand(upgraded, { game: 'pickaxe', value: 'big' }, { ...message, id: 'mine-4' })
    expect(enlarged.pickaxe.bigHits).toBe(1)
    expect(enlarged.pickaxe.combo).toBe(4)
    const mega = applyCommand(enlarged, { game: 'pickaxe', value: 'mega' }, { ...message, id: 'mine-5' })
    expect(mega.pickaxe.megaTnt).toBe(1)
    expect(mega.pickaxe.depth).toBe(0)
  })

  it('lets the boss damage the community and viewers heal it', () => {
    const attacked = applyRaidBossAttack(createInitialSignals(), 'Korzar', 0)
    expect(attacked.raid.communityHp).toBeLessThan(RAID_COMMUNITY_MAX_HP)
    expect(attacked.raid.bossAttacks).toBe(1)
    expect(attacked.raid.lastAction).toBe('boss')

    const message = { id: 'raid-heal-1', platform: 'youtube' as const, kind: 'textMessageEvent', text: '!iyileş', publishedAt: new Date().toISOString(), replay: false, amount: null, author: { id: 'healer-1', name: 'Şifacı', avatar: null, isOwner: false, isModerator: false, isMember: false } }
    const healed = applyCommand(attacked, { game: 'raid', value: 'heal' }, message)
    expect(healed.raid.communityHp).toBeGreaterThan(attacked.raid.communityHp)
    expect(healed.raid.communityHp).toBeLessThanOrEqual(RAID_COMMUNITY_MAX_HP)
    expect(healed.raid.heals).toBe(1)
    expect(healed.raid.lastAction).toBe('heal')
  })

  it('revives a defeated raid community without counting a paid or viewer heal', () => {
    const defeated = createInitialSignals()
    defeated.raid.communityHp = 0
    defeated.raid.heals = 3
    defeated.raid.healing = 72
    defeated.raid.lastAction = 'boss'
    const revived = reviveRaidCommunity(defeated)
    expect(revived.raid.communityHp).toBe(RAID_COMMUNITY_MAX_HP)
    expect(revived.raid.heals).toBe(3)
    expect(revived.raid.healing).toBe(72)
    expect(revived.raid.lastAction).toBe('revive')
  })

  it('ignores boss-hit commands while the raid community is defeated', () => {
    const defeated = createInitialSignals()
    defeated.raid.communityHp = 0
    const message = { id: 'raid-dead-hit', platform: 'youtube' as const, kind: 'textMessageEvent', text: 'vur', publishedAt: new Date().toISOString(), replay: false, amount: null, author: { id: 'fighter-1', name: 'Savaşçı', avatar: null, isOwner: false, isModerator: false, isMember: false } }
    const unchanged = applyCommand(defeated, { game: 'raid', value: 'hit' }, message)
    expect(unchanged.raid.damage).toBe(0)
    expect(unchanged.raid.hits).toBe(0)
  })

  it('applies deterministic raid damage without paid or member advantage', () => {
    const message = { id: 'raid-hit-1', platform: 'youtube' as const, kind: 'textMessageEvent', text: '!vur', publishedAt: new Date().toISOString(), replay: false, amount: '₺100', author: { id: 'member-1', name: 'Üye', avatar: null, isOwner: false, isModerator: false, isMember: true } }
    const next = applyCommand(createInitialSignals(), { game: 'raid', value: 'hit' }, message)
    expect(next.raid.hits).toBe(1)
    expect(next.raid.damage).toBeGreaterThanOrEqual(8)
    expect(next.raid.damage).toBeLessThanOrEqual(15)
    expect(next.raid.lastDamage).toBe(next.raid.damage)
    const repeated = applyCommand(next, { game: 'raid', value: 'hit' }, { ...message, id: 'raid-hit-2' })
    expect(repeated.raid.hits).toBe(2)
    expect(repeated.raid.damage).toBeGreaterThan(next.raid.damage)
  })

  it('recognizes puzzle answers for the active round', () => {
    expect(questions).toHaveLength(80)
    expect(new Set(questions.map((question) => question.question)).size).toBe(80)
    expect(questions.every((question) => question.answers.length === 4 && question.correct >= 0 && question.correct < 4)).toBe(true)
    expect(emojiPuzzles).toHaveLength(80)
    expect(new Set(emojiPuzzles.map((puzzle) => puzzle.answer)).size).toBe(80)
    expect(emojiPuzzles.every((puzzle) => puzzle.clues.length === 3)).toBe(true)
    expect(wordPuzzles).toHaveLength(120)
    expect(new Set(wordPuzzles.map((puzzle) => puzzle.answer)).size).toBe(120)
    expect(wordPuzzles.every((puzzle) => puzzle.scrambled.replaceAll(' ', '').toLocaleLowerCase('tr-TR') !== puzzle.answer.toLocaleLowerCase('tr-TR'))).toBe(true)
    expect(teams).toHaveLength(32)
    expect(new Set(teams.map((team) => team.id)).size).toBe(32)
    expect(new Set(teams.map((team) => team.command)).size).toBe(32)
    expect(parseGameCommand('emoji', 'GÖKKUŞAĞI', 0)).toEqual({ game: 'emoji', value: 'correct' })
    expect(parseGameCommand('word', 'kamera', 0)).toEqual({ game: 'word', value: 'correct' })
    expect(parseGameCommand('word', 'yanlış', 0)).toEqual({ game: 'word', value: 'attempt' })
    expect(parseGameCommand('word', 'dans', 59)).toEqual({ game: 'word', value: 'correct' })
  })

  it('accepts every country in the full flag catalog', () => {
    expect(countries).toHaveLength(197)
    expect(new Set(countries.map((country) => country.code)).size).toBe(197)
    expect(parseGameCommand('wheel', 'Kosova', 0)).toEqual({ game: 'wheel', value: 'Kosova' })
    expect(parseGameCommand('wheel', 'Yeni Zelanda', 0)).toEqual({ game: 'wheel', value: 'Yeni Zelanda' })
  })
})
