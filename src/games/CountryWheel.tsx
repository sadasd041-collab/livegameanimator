import { useMemo } from 'react'
import { countries } from '../data'

type CountryWheelProps = {
  round: number
  running: boolean
  votes: Record<string, number>
}

const flagImage = (code: string) => `https://flagcdn.com/w80/${code.toLowerCase()}.png`

export function CountryWheel({ round, running, votes }: CountryWheelProps) {
  const voteWinner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0]
  const visibleCountries = useMemo(() => {
    const voted = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => countries.find((country) => country.name === name))
      .filter((country): country is (typeof countries)[number] => Boolean(country))
    const start = (round * 17) % countries.length
    const rotationPool = Array.from({ length: 18 }, (_, index) => countries[(start + index) % countries.length])
    return [...voted, ...rotationPool].filter((country, index, list) => list.findIndex((item) => item.code === country.code) === index).slice(0, 12)
  }, [round, votes])
  const fallbackWinner = visibleCountries[round % visibleCountries.length]
  const winner = countries.find((country) => country.name === voteWinner) || fallbackWinner
  const winnerIndex = Math.max(0, visibleCountries.findIndex((country) => country.code === winner.code))
  const segmentAngle = 360 / visibleCountries.length
  const gradient = visibleCountries.map((country, index) => {
    const start = index * segmentAngle
    return `${country.color} ${start}deg ${start + segmentAngle}deg`
  }).join(', ')

  const rotation = useMemo(() => 1080 + (360 - winnerIndex * segmentAngle - segmentAngle / 2), [segmentAngle, winnerIndex])
  const ribbonStart = Math.max(0, countries.findIndex((country) => country.code === winner.code))
  const ribbon = Array.from({ length: 8 }, (_, index) => countries[(ribbonStart + index) % countries.length])

  return (
    <div className="wheel-scene">
      <div className="wheel-heading">
        <small>{countries.length} ÜLKE · TÜM BAYRAKLAR</small>
        <h2>DÜNYA DERBİSİ</h2>
        <p>Ülke adını yaz, bayrağını çarka taşı</p>
      </div>

      <div className="wheel-stage">
        <div className="wheel-pointer" />
        <div
          className={`country-wheel ${running ? 'spinning' : ''}`}
          style={{
            background: `conic-gradient(${gradient})`,
            '--wheel-rotation': `${rotation}deg`,
          } as React.CSSProperties}
        >
          {visibleCountries.map((country, index) => (
            <div
              className="wheel-label"
              key={country.name}
              title={country.name}
              style={{ transform: `rotate(${index * segmentAngle + segmentAngle / 2}deg) translateY(var(--wheel-label-radius, -82px)) rotate(${-index * segmentAngle - segmentAngle / 2}deg)` }}
            >
              <span><img src={flagImage(country.code)} alt={`${country.name} bayrağı`} /></span><small>{country.code}</small>
            </div>
          ))}
          <div className="wheel-core"><img src={flagImage(winner.code)} alt={`${winner.name} bayrağı`} /><small>{winner.code}</small></div>
        </div>
      </div>

      <div className="winner-chip">
        <span><img src={flagImage(winner.code)} alt={`${winner.name} bayrağı`} /></span>
        <div><small>SIRADAKİ ÜLKE</small><strong>{winner.name}</strong></div>
        <em>{votes[winner.name] || 0} oy</em>
      </div>
      <div className="country-ribbon" aria-label="Ülke bayrakları">
        {ribbon.map((country) => <span title={country.name} key={country.code}><img src={flagImage(country.code)} alt={`${country.name} bayrağı`} loading="lazy" /><small>{country.code}</small></span>)}
      </div>
    </div>
  )
}
