import type { CSSProperties } from 'react'
import { raidBosses } from './raidData'

type RaidGameProps = {
  round: number
  damage: number
  hits: number
  lastDamage?: number
  communityHp?: number
  heals?: number
  healing?: number
  lastHeal?: number
  bossAttacks?: number
  lastBossDamage?: number
  lastAction?: 'hit' | 'heal' | 'boss' | 'revive' | null
  lastActor: string | null
  continuous?: boolean
}

export function RaidGame({ round, damage, hits, lastDamage = 0, communityHp = 250, heals = 0, healing = 0, lastHeal = 0, bossAttacks = 0, lastBossDamage = 0, lastAction = null, lastActor, continuous = false }: RaidGameProps) {
  const boss = raidBosses[round % raidBosses.length]
  const hp = Math.max(0, boss.maxHp - damage)
  const hpPercent = Math.max(0, hp / boss.maxHp * 100)
  const communityHealth = Math.max(0, Math.min(250, communityHp))
  const communityPercent = communityHealth / 250 * 100
  const bossDefeated = hp === 0
  const communityDefeated = communityHealth === 0
  const style = { '--raid-accent': boss.color, '--raid-secondary': boss.secondary } as CSSProperties
  const eventText = lastAction === 'boss'
    ? `${boss.name} topluluğa ${lastBossDamage} hasar verdi!`
    : lastAction === 'revive'
      ? 'Topluluk yeniden ayağa kalktı ve savaşa döndü!'
    : lastAction === 'heal'
      ? lastHeal > 0 ? `${lastActor} topluluğu +${lastHeal} iyileştirdi` : 'Topluluğun canı zaten dolu'
      : lastAction === 'hit'
        ? `${lastActor} ${boss.name}’a ${lastDamage} hasar verdi`
        : 'Saldır: vur · Topluluğu iyileştir: iyileş'

  return <div className={`raid-scene raid-theme-${boss.id} ${communityDefeated ? 'community-defeated' : ''}`} style={style}>
    <div className="raid-world" aria-hidden="true">
      <div className="raid-world-sky" />
      <div className="raid-world-layer far" />
      <div className="raid-world-layer near" />
      <div className="raid-world-ground"><i /><i /><i /></div>
      <div className="raid-world-weather">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
      <div className="raid-world-effect one" /><div className="raid-world-effect two" />
    </div>
    <div className="raid-heading">
      <small>TOPLULUK RAID’İ · {continuous ? 'KESİNTİSİZ' : `TUR ${round + 1}`}</small>
      <h2>{bossDefeated ? 'BOSS YENİLDİ!' : communityDefeated ? 'TOPLULUK YENİLDİ!' : boss.name}</h2>
      <p>{bossDefeated ? 'Topluluk birlikte kazandı' : communityDefeated ? '3 saniye içinde topluluk yeniden savaşa dönecek' : `${boss.title} · ${boss.ability}`}</p>
    </div>

    <div className={`raid-arena ${bossDefeated ? 'defeated' : ''}`}>
      {lastAction === 'hit' && damage > 0 && <div className="raid-hit-flash" key={`hit-${round}-${hits}-${damage}`}><span>{lastActor || 'Topluluk'} VURDU</span><b>-{lastDamage || Math.min(15, Math.max(8, damage))} HASAR</b></div>}
      {lastAction === 'boss' && bossAttacks > 0 && <div className="raid-community-impact" key={`boss-${bossAttacks}`}><span>BOSS SALDIRISI</span><b>-{lastBossDamage}</b></div>}
      {lastAction === 'heal' && lastHeal > 0 && <div className="raid-heal-burst" key={`heal-${heals}`}><span>TOPLULUK İYİLEŞTİ</span><b>+{lastHeal}</b></div>}
      {lastAction === 'revive' && <div className="raid-revive-burst"><span>TOPLULUK GERİ DÖNDÜ</span><b>250 CAN</b></div>}
      <div className={`raid-character-art raid-character-art-${boss.id} ${lastAction === 'boss' ? 'attacking' : ''}`} key={`${boss.id}-${damage}-${bossAttacks}`}>
        <img src={boss.image} alt={`${boss.name}, ${boss.title}`} draggable={false} />
      </div>
      <div className="raid-boss-card"><em>BOSS YETENEĞİ</em><span>{boss.title}</span><strong>{boss.ability}</strong></div>
    </div>

    <div className="raid-health-stack">
      <div className="raid-health boss"><div><span>BOSS CANI</span><strong>{hp} / {boss.maxHp}</strong></div><i><b style={{ width: `${hpPercent}%` }} /></i></div>
      <div className="raid-health community"><div><span>TOPLULUK CANI</span><strong>{communityHealth} / 250</strong></div><i><b style={{ width: `${communityPercent}%` }} /></i></div>
    </div>
    <div className="raid-stats"><span><strong>{hits}</strong> saldırı</span><span><strong>{healing}</strong> iyileştirme</span><span><strong>{bossAttacks}</strong> boss vuruşu</span></div>
    <div className={`raid-actor ${lastAction || ''}`}>{eventText}</div>
  </div>
}
