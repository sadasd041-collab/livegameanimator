import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const dataDirectory = path.resolve(process.cwd(), '.live-game-animator')
const dataFile = path.join(dataDirectory, 'runtime.json')
const temporaryFile = path.join(dataDirectory, 'runtime.tmp.json')

const freshStore = () => ({
  version: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stats: {
    totalMessages: 0,
    acceptedMessages: 0,
    blockedMessages: 0,
    acceptedCommands: 0,
    uniqueAuthorHashes: [],
    byPlatform: {},
    byGame: {},
  },
  moderation: {
    enabled: true,
    blockedWords: ['küfür', 'hakaret', 'reklam', 'spamlink'],
    cooldownMs: 900,
    maxMessageLength: 300,
  },
  players: {},
  sessions: [],
  events: [],
})

let store = freshStore()
let writeTimer = null
let writing = Promise.resolve()
let persistenceError = null

export async function initializeStore() {
  await mkdir(dataDirectory, { recursive: true })
  try {
    const saved = JSON.parse(await readFile(dataFile, 'utf8'))
    store = {
      ...freshStore(),
      ...saved,
      version: 2,
      stats: { ...freshStore().stats, ...(saved.stats || {}) },
      moderation: { ...freshStore().moderation, ...(saved.moderation || {}) },
      players: saved.players && typeof saved.players === 'object' ? saved.players : {},
      sessions: Array.isArray(saved.sessions) ? saved.sessions.slice(0, 100) : [],
      events: Array.isArray(saved.events) ? saved.events.slice(0, 250) : [],
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      await flushStore()
    } else if (error instanceof SyntaxError) {
      const corruptFile = path.join(dataDirectory, `runtime.corrupt-${Date.now()}.json`)
      await rename(dataFile, corruptFile)
      store = freshStore()
      await flushStore()
    } else {
      persistenceError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }
  return snapshotStore()
}

function scheduleWrite() {
  store.updatedAt = new Date().toISOString()
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => void flushStore().catch(() => undefined), 250)
}

export async function flushStore() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = null
  const payload = JSON.stringify(store, null, 2)
  writing = writing.catch(() => undefined).then(async () => {
    await mkdir(dataDirectory, { recursive: true })
    await writeFile(temporaryFile, payload, 'utf8')
    await rename(temporaryFile, dataFile)
    persistenceError = null
  }).catch((error) => {
    persistenceError = error instanceof Error ? error.message : String(error)
    throw error
  })
  return writing
}

export function getPersistenceStatus() {
  return { ready: persistenceError === null, error: persistenceError, updatedAt: store.updatedAt }
}

export function snapshotStore() {
  return JSON.parse(JSON.stringify(store))
}

export function getModeration() {
  return { ...store.moderation, blockedWords: [...store.moderation.blockedWords] }
}

export function updateModeration(settings = {}) {
  store.moderation = {
    enabled: settings.enabled === undefined ? store.moderation.enabled : Boolean(settings.enabled),
    blockedWords: Array.isArray(settings.blockedWords)
      ? [...new Set(settings.blockedWords.map((word) => String(word).trim().toLocaleLowerCase('tr-TR')).filter(Boolean))].slice(0, 100)
      : store.moderation.blockedWords,
    cooldownMs: Math.max(0, Math.min(30_000, Number(settings.cooldownMs ?? store.moderation.cooldownMs))),
    maxMessageLength: Math.max(20, Math.min(500, Number(settings.maxMessageLength ?? store.moderation.maxMessageLength))),
  }
  addEvent('moderation-updated', { blockedWordCount: store.moderation.blockedWords.length })
  scheduleWrite()
  return getModeration()
}

const authorHash = (value) => createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16)

export function recordMessage({ platform, authorId, blocked = false, reason = null }) {
  store.stats.totalMessages += 1
  store.stats[blocked ? 'blockedMessages' : 'acceptedMessages'] += 1
  store.stats.byPlatform[platform || 'unknown'] = (store.stats.byPlatform[platform || 'unknown'] || 0) + 1
  const hash = authorHash(authorId)
  if (!store.stats.uniqueAuthorHashes.includes(hash)) store.stats.uniqueAuthorHashes.push(hash)
  if (store.stats.uniqueAuthorHashes.length > 20_000) store.stats.uniqueAuthorHashes = store.stats.uniqueAuthorHashes.slice(-20_000)
  if (blocked) addEvent('message-blocked', { platform, reason })
  scheduleWrite()
}

const weekKey = (date = new Date()) => {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

const publicPlayer = (player) => ({
  id: player.id,
  name: player.name,
  platform: player.platform,
  xp: player.xp,
  level: Math.max(1, Math.floor(Math.sqrt(player.xp / 100)) + 1),
  weeklyXp: player.weeklyXp,
  commands: player.commands,
  correctAnswers: player.correctAnswers,
  combo: player.combo,
  bestCombo: player.bestCombo,
  isMember: player.isMember,
  lastSeenAt: player.lastSeenAt,
})

export function getWeeklyLeaderboard(limit = 20) {
  const currentWeek = weekKey()
  let reset = false
  for (const player of Object.values(store.players)) {
    if (player.weekKey !== currentWeek) {
      player.weekKey = currentWeek
      player.weeklyXp = 0
      reset = true
    }
  }
  if (reset) scheduleWrite()
  return Object.values(store.players)
    .filter((player) => player.weeklyXp > 0)
    .sort((a, b) => b.weeklyXp - a.weeklyXp || b.bestCombo - a.bestCombo || a.name.localeCompare(b.name, 'tr'))
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 20)))
    .map(publicPlayer)
}

export function recordCommand({ game, command, authorId, authorName, platform, isMember = false, correct = null }) {
  store.stats.acceptedCommands += 1
  store.stats.byGame[game] = (store.stats.byGame[game] || 0) + 1
  let profile = null
  let xpGain = 0
  if (authorId) {
    const id = authorHash(authorId)
    const currentWeek = weekKey()
    const player = store.players[id] || {
      id,
      name: 'İzleyici',
      platform: platform || 'unknown',
      xp: 0,
      weeklyXp: 0,
      weekKey: currentWeek,
      commands: 0,
      correctAnswers: 0,
      combo: 0,
      bestCombo: 0,
      isMember: false,
      lastSeenAt: new Date().toISOString(),
    }
    if (player.weekKey !== currentWeek) {
      player.weekKey = currentWeek
      player.weeklyXp = 0
    }
    xpGain = 10 + (correct === true ? 25 : 0)
    player.name = String(authorName || player.name).trim().slice(0, 80) || player.name
    player.platform = platform || player.platform
    player.xp += xpGain
    player.weeklyXp += xpGain
    player.commands += 1
    if (correct === true) {
      player.correctAnswers += 1
      player.combo += 1
      player.bestCombo = Math.max(player.bestCombo, player.combo)
    } else if (correct === false) player.combo = 0
    player.isMember = Boolean(player.isMember || isMember)
    player.lastSeenAt = new Date().toISOString()
    store.players[id] = player
    const playerIds = Object.keys(store.players)
    if (playerIds.length > 20_000) {
      playerIds.sort((left, right) => String(store.players[left].lastSeenAt).localeCompare(String(store.players[right].lastSeenAt)))
      for (const staleId of playerIds.slice(0, playerIds.length - 20_000)) delete store.players[staleId]
    }
    profile = publicPlayer(player)
  }
  addEvent('command', { game, command: String(command || '').slice(0, 40), playerId: profile?.id, xpGain })
  scheduleWrite()
  return { player: profile, xpGain, leaderboard: getWeeklyLeaderboard(20) }
}

export function startSession({ platform = 'unknown', title = '', description = '', tags = [] } = {}) {
  const metadata = {
    title: String(title || '').trim().slice(0, 140),
    description: String(description || '').trim().slice(0, 2_000),
    tags: Array.isArray(tags) ? [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 20) : [],
  }
  const current = store.sessions.find((item) => item.status === 'live')
  if (current) {
    if (platform !== 'unknown') current.platform = platform
    if (metadata.title) Object.assign(current, metadata)
    scheduleWrite()
    return current
  }
  const session = {
    id: `session-${Date.now()}`,
    platform,
    ...metadata,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'live',
  }
  store.sessions.unshift(session)
  store.sessions = store.sessions.slice(0, 100)
  addEvent('stream-started', { sessionId: session.id, platform })
  scheduleWrite()
  return session
}

export function stopSession() {
  const session = store.sessions.find((item) => item.status === 'live')
  if (!session) return null
  session.endedAt = new Date().toISOString()
  session.status = 'completed'
  addEvent('stream-stopped', { sessionId: session.id })
  scheduleWrite()
  return session
}

export function addEvent(type, detail = {}) {
  store.events.unshift({ id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, detail, at: new Date().toISOString() })
  store.events = store.events.slice(0, 250)
  scheduleWrite()
}

export function resetAnalytics() {
  const moderation = getModeration()
  store = freshStore()
  store.moderation = moderation
  scheduleWrite()
  return snapshotStore()
}
