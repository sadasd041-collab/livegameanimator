import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import App from './App'
import { MockEventSource } from './test/setup'

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input)
  let payload: unknown = { connected: false, stream: { outputActive: false } }
  if (url.includes('/api/chat/status')) payload = { mode: 'off', connected: false, platform: null, videoId: null, videoTitle: null, pollIntervalMs: null, lastMessageAt: null, error: null, messageCount: 0, recentMessages: [] }
  if (url.includes('/api/analytics')) payload = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), stats: { totalMessages: 0, acceptedMessages: 0, blockedMessages: 0, acceptedCommands: 0, uniqueAuthors: 0, byPlatform: {}, byGame: {} }, sessions: [], events: [], weeklyLeaderboard: [] }
  if (url.includes('/api/diagnostics')) payload = { ok: true, uptimeSeconds: 1, obs: { connected: false, reconnectArmed: false, stream: {} }, chat: { connected: false, mode: 'off', error: null }, sseClients: 1, stageClients: 0, memoryMb: { rss: 50, heapUsed: 20 }, persistence: { ready: true, updatedAt: new Date().toISOString() } }
  if (url.includes('/api/moderation')) payload = { enabled: true, blockedWords: [], cooldownMs: 900, maxMessageLength: 300 }
  return { ok: true, json: async () => payload }
}))

afterEach(cleanup)

describe('Live Game Animator', () => {
  it('renders all nine interactive scenes and the chat console', async () => {
    render(<App />)
    for (const name of ['Halı Saha', 'Bilgi Yarışması', 'Ülke Çarkı', 'Emoji Bil', 'Kelime Avı', 'Sayı Kapışması', 'Falling Pickaxe', 'Boss Raid', 'Tetris']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
    expect(await screen.findByText('Otomasyonu dene')).toBeInTheDocument()
    expect(screen.getByText('Yorum bağlantısı bekleniyor')).toBeInTheDocument()
  })

  it('accepts repeated game votes from the same author', async () => {
    render(<StrictMode><App /></StrictMode>)
    await screen.findByText('Otomasyonu dene')
    const message = {
      id: 'vote-1', platform: 'demo', kind: 'textMessageEvent', text: '!gs',
      publishedAt: new Date().toISOString(), replay: false, amount: null,
      author: { id: 'viewer-1', name: 'Denetim', avatar: null, isOwner: false, isModerator: false, isMember: false },
    }
    act(() => MockEventSource.latest?.emit('chat-message', message))
    expect(await screen.findByText(/YORUM GÜCÜ · GS 1 \/ FB 0/)).toBeInTheDocument()

    act(() => MockEventSource.latest?.emit('chat-message', { ...message, id: 'vote-2' }))
    expect(await screen.findByText(/YORUM GÜCÜ · GS 2 \/ FB 0/)).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('allows the same author to hit the raid boss repeatedly', async () => {
    render(<App />)
    await screen.findByText('Otomasyonu dene')
    const raidButton = document.querySelector('.game-menu button:nth-child(8)') as HTMLButtonElement
    fireEvent.click(raidButton)
    expect(await screen.findByText('Vargul')).toBeInTheDocument()
    const message = {
      id: 'raid-repeat-1', platform: 'demo', kind: 'textMessageEvent', text: '!vur',
      publishedAt: new Date().toISOString(), replay: false, amount: null,
      author: { id: 'raider-1', name: 'Akıncı', avatar: null, isOwner: false, isModerator: false, isMember: false },
    }
    act(() => MockEventSource.latest?.emit('chat-message', message))
    await waitFor(() => expect(document.querySelector('.raid-stats span')?.textContent).toContain('1'))
    act(() => MockEventSource.latest?.emit('chat-message', { ...message, id: 'raid-repeat-2' }))
    await waitFor(() => expect(document.querySelector('.raid-stats span')?.textContent).toContain('2'))
  })
})
