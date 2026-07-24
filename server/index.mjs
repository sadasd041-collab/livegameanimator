import http from 'node:http'
import { fileURLToPath } from 'node:url'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import OBSWebSocket, { OBSWebSocketError } from 'obs-websocket-js'
import {
  flushStore,
  getPersistenceStatus,
  getWeeklyLeaderboard,
  getModeration,
  initializeStore,
  recordCommand,
  recordMessage,
  resetAnalytics,
  snapshotStore,
  startSession,
  stopSession,
  updateModeration,
} from './store.mjs'

await initializeStore()

const youtubeProto = protoLoader.loadSync(fileURLToPath(new URL('./youtube-stream.proto', import.meta.url)), {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: false,
  oneofs: true,
})
const youtubeGrpc = grpc.loadPackageDefinition(youtubeProto).youtube.api.v3
const youtubeStreamClient = new youtubeGrpc.V3DataLiveChatMessageService('youtube.googleapis.com:443', grpc.credentials.createSsl())

const port = Number(process.env.LGA_API_PORT || 8787)
const obs = new OBSWebSocket()
const eventClients = new Set()
const stageClients = new Set()

let obsConnected = false
let streamState = { outputActive: false, outputTimecode: '00:00:00.000' }
let demoTimer = null
let demoIndex = 0
let youtubeTimer = null
let youtubeStreamCall = null
let youtubeApiKey = ''
let recentMessages = []
let webhookSecret = ''
let obsCredentials = null
let obsReconnectTimer = null
let obsReconnectAttempts = 0
let manualObsDisconnect = false
const authorCooldowns = new Map()
const seenMessageIds = new Set()
const startedAt = Date.now()

const chatState = {
  mode: 'off',
  connected: false,
  platform: null,
  videoId: null,
  videoTitle: null,
  liveChatId: null,
  pageToken: null,
  pollIntervalMs: null,
  transport: null,
  lastMessageAt: null,
  error: null,
  messageCount: 0,
}

const demoAuthors = ['Mert', 'Elif', 'Deniz', 'Asya', 'Can', 'Ece', 'Baran', 'İrem', 'Ozan', 'Duru', 'Arda', 'Selin']
const demoGameNames = {
  football: 'Halı Saha', quiz: 'Bilgi Yarışması', wheel: 'Ülke Çarkı',
  emoji: 'Emoji Bil', word: 'Kelime Avı', numbers: 'Sayı Kapışması', pickaxe: 'Falling Pickaxe', raid: 'Boss Raid', tetris: 'Topluluk Tetris',
}
const defaultDemoCommands = {
  football: ['gs', 'fb'],
  quiz: ['A', 'B', 'C', 'D'],
  wheel: ['Türkiye', 'Japonya', 'Brezilya', 'Almanya'],
  emoji: ['tahmin'],
  word: ['tahmin'],
  numbers: ['1', '2'],
  pickaxe: ['tnt', 'hızlı', 'yavaş', 'büyük', 'tahta', 'taş', 'demir', 'altın', 'elmas', 'netherite', 'mega'],
  raid: ['vur', 'iyileş', 'saldır'],
  tetris: ['sol', 'sağ', 'döndür', 'indir'],
}
let demoContext = { game: 'football', round: 0, continuous: false, commands: defaultDemoCommands.football }

obs.on('ConnectionClosed', () => {
  obsConnected = false
  streamState = { outputActive: false, outputTimecode: '00:00:00.000' }
  publish('obs-status', { connected: false, stream: streamState })
  scheduleObsReconnect()
})

obs.on('StreamStateChanged', (event) => {
  const wasActive = Boolean(streamState.outputActive)
  streamState = { ...streamState, ...event }
  const isActive = Boolean(streamState.outputActive)
  if (!wasActive && isActive) startSession({ platform: 'unknown' })
  if (wasActive && !isActive) stopSession()
  publish('obs-status', { connected: obsConnected, stream: streamState })
})

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:5173',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
}

const send = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders,
    ...securityHeaders,
  })
  res.end(JSON.stringify(payload))
}

const readJson = async (req) => {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 64 * 1024) throw new Error('İstek gövdesi çok büyük.')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const safeChatStatus = () => ({
  mode: chatState.mode,
  connected: chatState.connected,
  platform: chatState.platform,
  videoId: chatState.videoId,
  videoTitle: chatState.videoTitle,
  pollIntervalMs: chatState.pollIntervalMs,
  transport: chatState.transport,
  lastMessageAt: chatState.lastMessageAt,
  error: chatState.error,
  messageCount: chatState.messageCount,
  recentMessages,
})

function publish(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of eventClients) {
    try {
      client.write(frame)
    } catch {
      eventClients.delete(client)
    }
  }
}

function publishStatus() {
  publish('chat-status', safeChatStatus())
}

function normalizeModerationText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function moderateMessage(message) {
  if (message.replay) return { allowed: true, reason: null }
  const settings = getModeration()
  if (!settings.enabled) return { allowed: true, reason: null }
  if (String(message.text || '').length > settings.maxMessageLength) return { allowed: false, reason: 'message-too-long' }
  const normalized = normalizeModerationText(message.text)
  if (settings.blockedWords.some((word) => normalized.includes(normalizeModerationText(word)))) return { allowed: false, reason: 'blocked-word' }
  const now = Date.now()
  const previous = authorCooldowns.get(message.author.id) || 0
  if (!message.author.isModerator && !message.author.isOwner && settings.cooldownMs > 0 && now - previous < settings.cooldownMs) {
    return { allowed: false, reason: 'cooldown' }
  }
  authorCooldowns.set(message.author.id, now)
  if (authorCooldowns.size > 20_000) authorCooldowns.clear()
  return { allowed: true, reason: null }
}

function rememberMessage(message) {
  const messageKey = `${message.platform}:${message.id}`
  if (seenMessageIds.has(messageKey)) return false
  seenMessageIds.add(messageKey)
  if (seenMessageIds.size > 20_000) {
    const oldest = seenMessageIds.values().next().value
    if (oldest) seenMessageIds.delete(oldest)
  }
  const moderation = moderateMessage(message)
  if (!moderation.allowed) {
    recordMessage({ platform: message.platform, authorId: message.author.id, blocked: true, reason: moderation.reason })
    publish('moderation-event', { reason: moderation.reason, author: message.author.name, at: new Date().toISOString() })
    return false
  }
  recentMessages = [message, ...recentMessages.filter((item) => item.id !== message.id)].slice(0, 30)
  chatState.messageCount += 1
  chatState.lastMessageAt = message.publishedAt
  if (!message.replay) recordMessage({ platform: message.platform, authorId: message.author.id })
  publish('chat-message', message)
  return true
}

function clearObsReconnectTimer() {
  if (obsReconnectTimer) clearTimeout(obsReconnectTimer)
  obsReconnectTimer = null
}

function scheduleObsReconnect() {
  clearObsReconnectTimer()
  if (manualObsDisconnect || !obsCredentials || obsConnected) return
  const delay = Math.min(60_000, 5_000 * (2 ** Math.min(obsReconnectAttempts, 4)))
  obsReconnectTimer = setTimeout(() => void attemptObsReconnect(), delay)
}

async function attemptObsReconnect() {
  if (manualObsDisconnect || !obsCredentials || obsConnected) return
  try {
    await obs.connect(obsCredentials.url, obsCredentials.password)
    obsConnected = true
    obsReconnectAttempts = 0
    clearObsReconnectTimer()
    publish('obs-status', { connected: true, stream: streamState, reconnected: true })
  } catch {
    obsReconnectAttempts += 1
    scheduleObsReconnect()
  }
}

function clearYoutubeTimer() {
  if (youtubeTimer) clearTimeout(youtubeTimer)
  youtubeTimer = null
  if (youtubeStreamCall) {
    const call = youtubeStreamCall
    youtubeStreamCall = null
    call.cancel()
  }
}

function stopDemo() {
  if (demoTimer) clearInterval(demoTimer)
  demoTimer = null
}

function resetChatState() {
  clearYoutubeTimer()
  stopDemo()
  youtubeApiKey = ''
  webhookSecret = ''
  chatState.mode = 'off'
  chatState.connected = false
  chatState.platform = null
  chatState.videoId = null
  chatState.videoTitle = null
  chatState.liveChatId = null
  chatState.pageToken = null
  chatState.pollIntervalMs = null
  chatState.transport = null
  chatState.lastMessageAt = null
  chatState.error = null
  chatState.messageCount = 0
  recentMessages = []
  authorCooldowns.clear()
  seenMessageIds.clear()
  publishStatus()
}

function normalizeVideoId(input) {
  const value = String(input || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''
    if (url.hostname.endsWith('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v')
      const parts = url.pathname.split('/').filter(Boolean)
      const marker = parts.findIndex((part) => ['live', 'embed', 'shorts'].includes(part))
      if (marker >= 0) return parts[marker + 1] || ''
    }
  } catch {
    return ''
  }
  return ''
}

async function youtubeFetch(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  url.searchParams.set('key', youtubeApiKey)

  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  const payload = await response.json()
  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason
    const message = payload?.error?.message || 'YouTube API isteği başarısız oldu.'
    throw new Error(reason ? `${message} (${reason})` : message)
  }
  return payload
}

function normalizeYoutubeMessage(item, replay = false) {
  const snippet = item.snippet || {}
  const author = item.authorDetails || {}
  const superChat = snippet.superChatDetails
  const superSticker = snippet.superStickerDetails
  const memberMessage = snippet.memberMilestoneChatDetails
  const text = snippet.textMessageDetails?.messageText
    || superChat?.userComment
    || memberMessage?.userComment
    || snippet.displayMessage
    || superSticker?.superStickerMetadata?.altText
    || ''

  return {
    id: String(item.id),
    platform: 'youtube',
    kind: snippet.type || 'textMessageEvent',
    text: String(text).slice(0, 500),
    publishedAt: snippet.publishedAt || new Date().toISOString(),
    replay,
    amount: superChat?.amountDisplayString || superSticker?.amountDisplayString || null,
    author: {
      id: author.channelId || snippet.authorChannelId || 'unknown',
      name: String(author.displayName || 'İzleyici').slice(0, 80),
      avatar: author.profileImageUrl || null,
      isOwner: Boolean(author.isChatOwner),
      isModerator: Boolean(author.isChatModerator),
      isMember: Boolean(author.isChatSponsor),
    },
  }
}

const youtubeTypeNames = {
  TEXT_MESSAGE_EVENT: 'textMessageEvent',
  NEW_SPONSOR_EVENT: 'newSponsorEvent',
  MEMBER_MILESTONE_CHAT_EVENT: 'memberMilestoneChatEvent',
  MEMBERSHIP_GIFTING_EVENT: 'membershipGiftingEvent',
  GIFT_MEMBERSHIP_RECEIVED_EVENT: 'giftMembershipReceivedEvent',
  SUPER_CHAT_EVENT: 'superChatEvent',
  SUPER_STICKER_EVENT: 'superStickerEvent',
  POLL_EVENT: 'pollEvent',
  GIFT_EVENT: 'giftEvent',
  USER_BANNED_EVENT: 'userBannedEvent',
  CHAT_ENDED_EVENT: 'chatEndedEvent',
}

function normalizeGrpcYoutubeMessage(item, replay = false) {
  return normalizeYoutubeMessage({
    ...item,
    snippet: {
      ...(item.snippet || {}),
      type: youtubeTypeNames[item.snippet?.type] || String(item.snippet?.type || 'textMessageEvent'),
    },
  }, replay)
}

function startYoutubeStream() {
  if (chatState.mode !== 'youtube' || !chatState.liveChatId || !youtubeApiKey) return
  if (youtubeStreamCall) {
    const previous = youtubeStreamCall
    youtubeStreamCall = null
    previous.cancel()
  }
  if (youtubeTimer) clearTimeout(youtubeTimer)
  youtubeTimer = null

  const metadata = new grpc.Metadata()
  metadata.set('x-goog-api-key', youtubeApiKey)
  const call = youtubeStreamClient.streamList({
    liveChatId: chatState.liveChatId,
    part: ['id', 'snippet', 'authorDetails'],
    profileImageSize: 48,
    pageToken: chatState.pageToken || undefined,
    hl: 'tr',
  }, metadata)
  youtubeStreamCall = call
  chatState.transport = 'stream'
  chatState.pollIntervalMs = 0
  chatState.connected = true
  chatState.error = null
  publishStatus()

  const fallbackToPolling = (reason) => {
    if (youtubeStreamCall !== call) return
    youtubeStreamCall = null
    if (chatState.mode !== 'youtube') return
    chatState.transport = 'polling'
    chatState.connected = false
    chatState.error = `Düşük gecikmeli bağlantı kesildi; güvenli sorgulamaya dönülüyor${reason ? `: ${reason}` : '.'}`
    publishStatus()
    youtubeTimer = setTimeout(() => void pollYoutube(), 2_000)
  }

  call.on('data', (payload) => {
    if (youtubeStreamCall !== call || chatState.mode !== 'youtube') return
    for (const item of payload.items || []) rememberMessage(normalizeGrpcYoutubeMessage(item))
    chatState.pageToken = payload.nextPageToken || chatState.pageToken
    chatState.connected = true
    chatState.error = null
    publishStatus()
  })
  call.on('error', (error) => fallbackToPolling(error?.details || error?.message || 'bağlantı hatası'))
  call.on('end', () => fallbackToPolling('akış sona erdi'))
}

async function pollYoutube({ initial = false, schedule = true } = {}) {
  if (chatState.mode !== 'youtube' || !chatState.liveChatId) return

  try {
    const payload = await youtubeFetch('liveChat/messages', {
      liveChatId: chatState.liveChatId,
      part: 'id,snippet,authorDetails',
      maxResults: 200,
      pageToken: chatState.pageToken,
      profileImageSize: 48,
      hl: 'tr',
    })

    const messages = (payload.items || []).map((item) => normalizeYoutubeMessage(item, initial))
    if (initial) {
      for (const message of messages.slice(-12)) rememberMessage(message)
    } else {
      for (const message of messages) rememberMessage(message)
    }

    chatState.pageToken = payload.nextPageToken || chatState.pageToken
    chatState.pollIntervalMs = Math.max(2000, Number(payload.pollingIntervalMillis || 5000))
    chatState.transport = schedule ? 'polling' : chatState.transport
    chatState.connected = true
    chatState.error = null
    publishStatus()
    if (schedule) youtubeTimer = setTimeout(() => void pollYoutube(), chatState.pollIntervalMs)
  } catch (error) {
    chatState.error = error instanceof Error ? error.message : 'YouTube sohbeti okunamadı.'
    chatState.connected = false
    publishStatus()
    if (!schedule) throw error
    if (schedule) youtubeTimer = setTimeout(() => void pollYoutube(), 15_000)
  }
}

async function connectYoutube({ apiKey, videoId }) {
  resetChatState()
  const normalizedVideoId = normalizeVideoId(videoId)
  if (!String(apiKey || '').trim()) throw new Error('YouTube Data API anahtarı gerekli.')
  if (!normalizedVideoId) throw new Error('Geçerli bir YouTube canlı yayın bağlantısı veya video kimliği gerekli.')

  youtubeApiKey = String(apiKey).trim()
  const payload = await youtubeFetch('videos', {
    part: 'snippet,liveStreamingDetails',
    id: normalizedVideoId,
  })
  const video = payload.items?.[0]
  if (!video) throw new Error('YouTube yayını bulunamadı. API anahtarını ve video bağlantısını kontrol edin.')
  const liveChatId = video.liveStreamingDetails?.activeLiveChatId
  if (!liveChatId) throw new Error('Bu video şu anda canlı değil veya canlı sohbeti etkin değil.')

  chatState.mode = 'youtube'
  chatState.connected = true
  chatState.platform = 'youtube'
  chatState.videoId = normalizedVideoId
  chatState.videoTitle = video.snippet?.title || 'YouTube Canlı Yayını'
  chatState.liveChatId = liveChatId
  chatState.error = null
  publishStatus()
  await pollYoutube({ initial: true, schedule: false })
  startYoutubeStream()
  chatState.connected = true
  publishStatus()
  return safeChatStatus()
}

function updateDemoContext(input = {}) {
  const game = Object.hasOwn(defaultDemoCommands, input.game) ? input.game : demoContext.game
  const commands = Array.isArray(input.commands)
    ? [...new Set(input.commands.map((command) => String(command || '').trim()).filter(Boolean))].slice(0, 20)
    : []
  demoContext = {
    game,
    round: Math.max(0, Number(input.round || 0)),
    continuous: Boolean(input.continuous),
    commands: commands.length ? commands : defaultDemoCommands[game],
  }
  if (chatState.mode === 'demo') {
    chatState.videoTitle = `Demo · ${demoGameNames[game]} · ${demoContext.continuous ? 'Kesintisiz' : `Tur ${demoContext.round + 1}`}`
    publishStatus()
  }
  return demoContext
}

function startDemo(input = {}) {
  resetChatState()
  updateDemoContext(input)
  chatState.mode = 'demo'
  chatState.connected = true
  chatState.platform = 'demo'
  chatState.videoTitle = `Demo · ${demoGameNames[demoContext.game]} · ${demoContext.continuous ? 'Kesintisiz' : `Tur ${demoContext.round + 1}`}`
  publishStatus()

  const emitDemo = () => {
    const name = demoAuthors[demoIndex % demoAuthors.length]
    const text = demoContext.commands[demoIndex % demoContext.commands.length]
    const message = createDemoMessage({
      name,
      text,
      authorId: `demo-user-${demoIndex % 7}`,
      isModerator: demoIndex % 9 === 0,
      isMember: demoIndex % 4 === 0,
    })
    demoIndex += 1
    rememberMessage(message)
    publishStatus()
  }

  emitDemo()
  demoTimer = setInterval(emitDemo, 2400)
  return safeChatStatus()
}

function createDemoMessage({ name, text, authorId, isModerator = false, isMember = false }) {
  return {
    id: `demo-${Date.now()}-${demoIndex}-${Math.random().toString(36).slice(2, 8)}`,
    platform: 'demo',
    kind: 'textMessageEvent',
    text: String(text || '').trim().slice(0, 500),
    publishedAt: new Date().toISOString(),
    replay: false,
    amount: null,
    author: {
      id: String(authorId || `manual-${Date.now()}`).slice(0, 120),
      name: String(name || 'Test izleyicisi').trim().slice(0, 80),
      avatar: null,
      isOwner: false,
      isModerator: Boolean(isModerator),
      isMember: Boolean(isMember),
    },
  }
}

function createWebhookMessage(body) {
  const platform = ['tiktok', 'youtube', 'webhook'].includes(body.platform) ? body.platform : 'webhook'
  return {
    id: String(body.id || `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 160),
    platform,
    kind: String(body.kind || 'textMessageEvent').slice(0, 80),
    text: String(body.text || '').trim().slice(0, 500),
    publishedAt: body.publishedAt || new Date().toISOString(),
    replay: false,
    amount: body.amount ? String(body.amount).slice(0, 80) : null,
    author: {
      id: String(body.authorId || body.author?.id || `webhook-user-${Date.now()}`).slice(0, 160),
      name: String(body.authorName || body.author?.name || 'Canlı izleyici').trim().slice(0, 80),
      avatar: body.avatar || body.author?.avatar || null,
      isOwner: Boolean(body.isOwner || body.author?.isOwner),
      isModerator: Boolean(body.isModerator || body.author?.isModerator),
      isMember: Boolean(body.isMember || body.author?.isMember),
    },
  }
}

function connectWebhook({ secret, title, platform }) {
  resetChatState()
  if (String(secret || '').trim().length < 12) throw new Error('Webhook anahtarı en az 12 karakter olmalı.')
  webhookSecret = String(secret).trim()
  chatState.mode = 'webhook'
  chatState.connected = true
  chatState.platform = platform === 'tiktok' ? 'tiktok' : 'webhook'
  chatState.videoTitle = String(title || (platform === 'tiktok' ? 'TikTok yorum köprüsü' : 'Harici yorum köprüsü')).slice(0, 100)
  chatState.error = null
  publishStatus()
  return safeChatStatus()
}

const obsError = (error) => {
  if (error instanceof OBSWebSocketError) return error.message
  return error instanceof Error ? error.message : 'OBS işlemi başarısız oldu.'
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})

  try {
    if (req.method === 'GET' && req.url?.startsWith('/api/events')) {
      const role = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`).searchParams.get('role')
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...corsHeaders,
      })
      res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)
      res.write(`event: chat-status\ndata: ${JSON.stringify(safeChatStatus())}\n\n`)
      eventClients.add(res)
      if (role === 'stage') stageClients.add(res)
      req.on('close', () => {
        eventClients.delete(res)
        stageClients.delete(res)
      })
      return
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      return send(res, 200, { ok: true, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), obsConnected, chat: safeChatStatus() })
    }

    if (req.method === 'GET' && req.url === '/api/diagnostics') {
      const memory = process.memoryUsage()
      return send(res, 200, {
        ok: true,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        obs: { connected: obsConnected, reconnectArmed: Boolean(obsCredentials && !manualObsDisconnect), stream: streamState },
        chat: safeChatStatus(),
        sseClients: eventClients.size,
        stageClients: stageClients.size,
        memoryMb: { rss: Math.round(memory.rss / 1024 / 1024), heapUsed: Math.round(memory.heapUsed / 1024 / 1024) },
        persistence: getPersistenceStatus(),
      })
    }

    if (req.method === 'GET' && req.url === '/api/obs/status') {
      if (obsConnected) {
        try {
          streamState = await obs.call('GetStreamStatus')
        } catch {
          // Keep the last event snapshot while OBS changes output state.
        }
      }
      return send(res, 200, { connected: obsConnected, stream: streamState })
    }

    if (req.method === 'POST' && req.url === '/api/obs/connect') {
      const body = await readJson(req)
      clearObsReconnectTimer()
      manualObsDisconnect = false
      obsCredentials = { url: body.url || 'ws://127.0.0.1:4455', password: body.password || '' }
      if (obsConnected) await obs.disconnect()
      try {
        await obs.connect(obsCredentials.url, obsCredentials.password)
      } catch (error) {
        obsReconnectAttempts += 1
        scheduleObsReconnect()
        throw error
      }
      obsConnected = true
      obsReconnectAttempts = 0
      clearObsReconnectTimer()
      publish('obs-status', { connected: true, stream: streamState })
      return send(res, 200, { connected: true })
    }

    if (req.method === 'POST' && req.url === '/api/obs/disconnect') {
      manualObsDisconnect = true
      obsCredentials = null
      obsReconnectAttempts = 0
      clearObsReconnectTimer()
      if (obsConnected) await obs.disconnect()
      obsConnected = false
      return send(res, 200, { connected: false })
    }

    if (req.method === 'POST' && req.url === '/api/obs/destination') {
      if (!obsConnected) return send(res, 409, { error: 'Önce OBS bağlantısı kurulmalı.' })
      const body = await readJson(req)
      if (!body.server || !body.key) return send(res, 400, { error: 'RTMP sunucu adresi ve yayın anahtarı gerekli.' })
      await obs.call('SetStreamServiceSettings', {
        streamServiceType: 'rtmp_custom',
        streamServiceSettings: {
          server: body.server,
          key: body.key,
          use_auth: Boolean(body.username || body.password),
          username: body.username || '',
          password: body.password || '',
        },
      })
      return send(res, 200, { configured: true })
    }

    if (req.method === 'POST' && req.url === '/api/obs/stream/start') {
      if (!obsConnected) return send(res, 409, { error: 'Önce OBS bağlantısı kurulmalı.' })
      const body = await readJson(req)
      await obs.call('StartStream')
      const session = startSession({
        platform: body.platform || 'unknown',
        title: body.title,
        description: body.description,
        tags: body.tags,
      })
      return send(res, 200, { started: true, session })
    }

    if (req.method === 'POST' && req.url === '/api/obs/stream/stop') {
      if (!obsConnected) return send(res, 409, { error: 'Önce OBS bağlantısı kurulmalı.' })
      await obs.call('StopStream')
      const session = stopSession()
      return send(res, 200, { stopped: true, session })
    }

    if (req.method === 'POST' && req.url === '/api/obs/scene') {
      if (!obsConnected) return send(res, 409, { error: 'Önce OBS bağlantısı kurulmalı.' })
      const body = await readJson(req)
      await obs.call('SetCurrentProgramScene', { sceneName: body.sceneName })
      return send(res, 200, { sceneName: body.sceneName })
    }

    if (req.method === 'GET' && req.url === '/api/chat/status') {
      return send(res, 200, safeChatStatus())
    }

    if (req.method === 'GET' && req.url === '/api/moderation') {
      return send(res, 200, getModeration())
    }

    if (req.method === 'POST' && req.url === '/api/moderation') {
      return send(res, 200, updateModeration(await readJson(req)))
    }

    if (req.method === 'GET' && req.url === '/api/analytics') {
      const data = snapshotStore()
      return send(res, 200, { ...data, players: undefined, weeklyLeaderboard: getWeeklyLeaderboard(20), stats: { ...data.stats, uniqueAuthors: data.stats.uniqueAuthorHashes.length, uniqueAuthorHashes: undefined } })
    }

    if (req.method === 'POST' && req.url === '/api/analytics/command') {
      const body = await readJson(req)
      if (!body.game) return send(res, 400, { error: 'Oyun kimliği gerekli.' })
      const progression = recordCommand(body)
      return send(res, 200, { recorded: true, ...progression })
    }

    if (req.method === 'POST' && req.url === '/api/analytics/reset') {
      return send(res, 200, resetAnalytics())
    }

    if (req.method === 'POST' && req.url === '/api/chat/youtube/connect') {
      const body = await readJson(req)
      const status = await connectYoutube(body)
      return send(res, 200, status)
    }

    if (req.method === 'POST' && req.url === '/api/chat/demo/start') {
      return send(res, 200, startDemo(await readJson(req)))
    }

    if (req.method === 'POST' && req.url === '/api/chat/demo/context') {
      if (chatState.mode !== 'demo') return send(res, 409, { error: 'Demo yorum akışı aktif değil.' })
      updateDemoContext(await readJson(req))
      return send(res, 200, safeChatStatus())
    }

    if (req.method === 'POST' && req.url === '/api/chat/webhook/connect') {
      return send(res, 200, connectWebhook(await readJson(req)))
    }

    if (req.method === 'POST' && req.url === '/api/chat/webhook/message') {
      const authorization = String(req.headers.authorization || '')
      const suppliedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
      if (!webhookSecret || suppliedSecret !== webhookSecret) return send(res, 401, { error: 'Webhook anahtarı geçersiz.' })
      const message = createWebhookMessage(await readJson(req))
      if (!message.text) return send(res, 400, { error: 'Yorum metni gerekli.' })
      const accepted = rememberMessage(message)
      publishStatus()
      return send(res, accepted ? 200 : 202, { accepted, messageId: message.id })
    }

    if (req.method === 'POST' && req.url === '/api/chat/demo/message') {
      const body = await readJson(req)
      if (!String(body.text || '').trim()) return send(res, 400, { error: 'Test yorumu boş olamaz.' })
      if (chatState.mode !== 'demo') {
        resetChatState()
        chatState.mode = 'demo'
        chatState.connected = true
        chatState.platform = 'demo'
        chatState.videoTitle = 'Manuel test yorumları'
      }
      const message = createDemoMessage(body)
      rememberMessage(message)
      publishStatus()
      return send(res, 200, message)
    }

    if (req.method === 'POST' && req.url === '/api/chat/disconnect') {
      resetChatState()
      return send(res, 200, safeChatStatus())
    }

    return send(res, 404, { error: 'Bulunamadı.' })
  } catch (error) {
    const message = obsError(error)
    const status = error instanceof SyntaxError ? 400 : message === 'İstek gövdesi çok büyük.' ? 413 : 500
    return send(res, status, { error: status === 400 ? 'Geçersiz JSON isteği.' : message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Live Game Animator API http://127.0.0.1:${port}`)
})

const heartbeat = setInterval(() => {
  for (const client of eventClients) {
    try {
      client.write(`: heartbeat ${Date.now()}\n\n`)
    } catch {
      eventClients.delete(client)
    }
  }
}, 15_000)

async function shutdown() {
  clearInterval(heartbeat)
  clearYoutubeTimer()
  stopDemo()
  clearObsReconnectTimer()
  youtubeStreamClient.close()
  await flushStore().catch((error) => console.error('Kalıcı kayıt kapatılırken yazılamadı:', error))
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2_000).unref()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
