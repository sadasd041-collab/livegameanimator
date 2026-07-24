import { Activity, CheckCircle2, Clock3, Crown, Database, MessageCircle, Radio, RefreshCw, ShieldAlert, Star, Users } from 'lucide-react'
import { games } from '../data'
import type { AnalyticsSnapshot } from '../types'

type Diagnostics = {
  ok: boolean
  uptimeSeconds: number
  obs: { connected: boolean; reconnectArmed: boolean; stream: { outputActive?: boolean } }
  chat: { connected: boolean; mode: string; error: string | null }
  sseClients: number
  stageClients: number
  memoryMb: { rss: number; heapUsed: number }
  persistence: { ready: boolean; updatedAt: string }
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} sa ${minutes} dk`
}

export function BroadcastsView({ analytics, diagnostics, destinationReady, destinationLabel, metadataReady, onRefresh }: { analytics: AnalyticsSnapshot; diagnostics: Diagnostics | null; destinationReady: boolean; destinationLabel: string; metadataReady: boolean; onRefresh: () => void }) {
  const checks = [
    { label: 'Yerel API ve kalıcı kayıt', ok: Boolean(diagnostics?.ok && diagnostics.persistence.ready) },
    { label: 'OBS WebSocket bağlantısı', ok: Boolean(diagnostics?.obs.connected), detail: diagnostics?.obs.reconnectArmed ? 'Otomatik yeniden bağlanma hazır' : 'Bağlantı bekleniyor' },
    { label: `${destinationLabel} RTMP hedefi`, ok: destinationReady, detail: destinationReady ? 'Sunucu ve yayın anahtarı hazır' : 'Yayın anahtarı bekleniyor' },
    { label: 'Yayın bilgileri', ok: metadataReady, detail: metadataReady ? 'Başlık ve açıklama hazır' : 'Yayın başlığı bekleniyor' },
    { label: 'Canlı yorum motoru', ok: Boolean(diagnostics?.chat.connected), detail: diagnostics?.chat.mode || 'kapalı' },
    { label: 'OBS Browser Source izleyicisi', ok: Boolean(diagnostics?.stageClients), detail: `${diagnostics?.stageClients || 0} bağlı yayın sahnesi` },
  ]

  return <div className="operations-view">
    <div className="operations-heading"><div><span className="section-kicker">YAYIN OPERASYONU</span><h2>Yayın geçmişi ve ön kontrol</h2><p>Canlıya çıkmadan önce bağlantıları tek ekranda doğrulayın.</p></div><button onClick={onRefresh}><RefreshCw size={15} /> Yenile</button></div>
    <div className="preflight-grid">{checks.map((check) => <div className={check.ok ? 'ready' : 'waiting'} key={check.label}>{check.ok ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}<div><strong>{check.label}</strong><small>{check.ok ? check.detail || 'Hazır' : check.detail || 'Eksik'}</small></div></div>)}</div>
    <section className="panel operations-panel"><div className="operations-panel-head"><div><span className="section-kicker">OTURUMLAR</span><h3>Son yayınlar</h3></div><Radio size={18} /></div>
      {analytics.sessions.length ? <div className="session-table">{analytics.sessions.map((session) => <div key={session.id}><span className={`session-state ${session.status}`} /><div><strong>{session.title || `${session.platform.toLocaleUpperCase('tr-TR')} yayını`}</strong><small>{session.platform.toLocaleUpperCase('tr-TR')} · {new Date(session.startedAt).toLocaleString('tr-TR')}</small></div><em>{session.status === 'live' ? 'CANLI' : session.endedAt ? formatDuration(Math.max(0, (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)) : 'Tamamlandı'}</em></div>)}</div> : <div className="operations-empty"><Clock3 size={25} /><strong>Henüz kayıtlı yayın yok</strong><p>OBS üzerinden başlatılan ilk yayın burada saklanacak.</p></div>}
    </section>
  </div>
}

export function AnalyticsView({ analytics, diagnostics, onRefresh }: { analytics: AnalyticsSnapshot; diagnostics: Diagnostics | null; onRefresh: () => void }) {
  const gameRows = Object.entries(analytics.stats.byGame).sort((a, b) => b[1] - a[1])
  const maxGame = Math.max(1, ...gameRows.map(([, value]) => value))
  return <div className="operations-view">
    <div className="operations-heading"><div><span className="section-kicker">KALICI ANALİZ</span><h2>Yorum ve oyun performansı</h2><p>Veriler uygulama yeniden başlatıldığında kaybolmaz.</p></div><button onClick={onRefresh}><RefreshCw size={15} /> Yenile</button></div>
    <div className="analytics-metrics">
      <div><MessageCircle size={20} /><span>Toplam mesaj<strong>{analytics.stats.totalMessages}</strong></span></div>
      <div><Activity size={20} /><span>Geçerli komut<strong>{analytics.stats.acceptedCommands}</strong></span></div>
      <div><Users size={20} /><span>Tekil izleyici<strong>{analytics.stats.uniqueAuthors}</strong></span></div>
      <div><ShieldAlert size={20} /><span>Engellenen<strong>{analytics.stats.blockedMessages}</strong></span></div>
    </div>
    <div className="analytics-layout">
      <section className="panel operations-panel"><div className="operations-panel-head"><div><span className="section-kicker">OYUN DAĞILIMI</span><h3>En çok etkileşim alan oyunlar</h3></div><Activity size={18} /></div>{gameRows.length ? <div className="game-bars">{gameRows.map(([game, value]) => <div key={game}><span>{games.find((item) => item.id === game)?.shortName || game}</span><i><b style={{ width: `${value / maxGame * 100}%` }} /></i><strong>{value}</strong></div>)}</div> : <div className="operations-empty"><Activity size={25} /><strong>Komut verisi bekleniyor</strong><p>Geçerli oyun yorumları burada karşılaştırılacak.</p></div>}</section>
      <section className="panel operations-panel"><div className="operations-panel-head"><div><span className="section-kicker">SİSTEM</span><h3>Dayanıklılık durumu</h3></div><Database size={18} /></div><div className="system-stats"><div><span>Çalışma süresi</span><strong>{formatDuration(diagnostics?.uptimeSeconds || 0)}</strong></div><div><span>Bellek kullanımı</span><strong>{diagnostics?.memoryMb.heapUsed || 0} MB</strong></div><div><span>Kalıcı kayıt</span><strong>{diagnostics?.persistence.ready ? 'Aktif' : 'Bekliyor'}</strong></div><div><span>Son güncelleme</span><strong>{new Date(analytics.updatedAt).toLocaleTimeString('tr-TR')}</strong></div></div></section>
    </div>
    <section className="panel operations-panel leaderboard-panel"><div className="operations-panel-head"><div><span className="section-kicker">HAFTALIK LİG</span><h3>XP ve seviye liderleri</h3></div><Crown size={18} /></div>
      {(analytics.weeklyLeaderboard || []).length ? <div className="leaderboard-table">{(analytics.weeklyLeaderboard || []).map((player, index) => <div className={index < 3 ? 'podium' : ''} key={player.id}><em>{index + 1}</em><span className="leader-avatar">{player.name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span><div><strong>{player.name}{player.isMember && <b>ÜYE</b>}</strong><small>{player.platform.toLocaleUpperCase('tr-TR')} · En iyi combo {player.bestCombo}</small></div><span className="leader-level"><Star size={12} /> Seviye {player.level}</span><strong>{player.weeklyXp} XP</strong></div>)}</div> : <div className="operations-empty"><Crown size={25} /><strong>Haftalık lig başlamak üzere</strong><p>İlk geçerli oyun komutu sıralamayı oluşturacak.</p></div>}
    </section>
  </div>
}
