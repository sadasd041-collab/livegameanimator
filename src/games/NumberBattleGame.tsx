type NumberBattleGameProps = {
  votes: { one: number; two: number }
  lastActor: string | null
}

export function NumberBattleGame({ votes, lastActor }: NumberBattleGameProps) {
  const total = votes.one + votes.two
  const onePercent = total ? Math.round((votes.one / total) * 100) : 50
  const twoPercent = 100 - onePercent

  return (
    <div className="numbers-scene">
      <div className="numbers-heading"><small>SAYI KAPIŞMASI</small><h2>HANGİ TARAF KAZANACAK?</h2><p>Yoruma 1 veya 2 yaz</p></div>
      <div className="number-versus">
        <div className="number-side one"><strong>1</strong><span>{votes.one} oy</span></div>
        <em>VS</em>
        <div className="number-side two"><strong>2</strong><span>{votes.two} oy</span></div>
      </div>
      <div className="battle-meter"><span style={{ width: `${onePercent}%` }} /><i style={{ width: `${twoPercent}%` }} /></div>
      <div className="battle-percent"><strong>%{onePercent}</strong><strong>%{twoPercent}</strong></div>
      <div className="battle-actor">{lastActor ? `${lastActor} oyunu kullandı` : 'İlk oyu bekliyor'}</div>
    </div>
  )
}
