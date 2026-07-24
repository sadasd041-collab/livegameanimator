import { useEffect, useMemo, useState } from 'react'
import type { FootballSetup } from '../types'

type FootballGameProps = {
  round: number
  running: boolean
  votes: { home: number; away: number }
  lastActor: string | null
  teams: FootballSetup
}

const homePlayers = [
  [12, 50], [28, 24], [28, 76], [44, 39], [44, 64],
]
const awayPlayers = [
  [88, 50], [72, 24], [72, 76], [56, 39], [56, 64],
]

export function FootballGame({ round, running, votes, lastActor, teams }: FootballGameProps) {
  const [clock, setClock] = useState(12)
  const [score, setScore] = useState<[number, number]>([2, 1])
  const ballTarget = useMemo(() => ({
    left: `${32 + ((round * 17) % 38)}%`,
    top: `${28 + ((round * 23) % 44)}%`,
  }), [round])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setClock((value) => (value + 1) % 90), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (round > 0 && round % 3 === 0) {
      setScore((current) => [current[0] + 1, current[1]])
    }
  }, [round])

  useEffect(() => {
    const totalGoals = Math.floor((votes.home + votes.away) / 5)
    if (totalGoals > 0) setScore([2 + Math.floor(votes.home / 5), 1 + Math.floor(votes.away / 5)])
  }, [votes.home, votes.away])

  const teamStyle = (colors: [string, string]) => ({ '--team-primary': colors[0], '--team-secondary': colors[1] } as React.CSSProperties)

  return (
    <div className="football-scene">
      <div className="match-scorebar">
        <div className="team-code"><span className="team-mini-crest" style={teamStyle(teams.home.colors)}>{teams.home.crest}</span><span>{teams.home.shortName}</span></div>
        <strong>{score[0]} <span>:</span> {score[1]}</strong>
        <div className="team-code away-code"><span>{teams.away.shortName}</span><span className="team-mini-crest" style={teamStyle(teams.away.colors)}>{teams.away.crest}</span></div>
      </div>
      <div className="match-clock">{String(clock).padStart(2, '0')}:24</div>

      <div className="pitch-wrap">
        <div className="pitch-lines">
          <div className="center-line" />
          <div className="center-circle" />
          <div className="penalty-box left" />
          <div className="penalty-box right" />
          <div className="goal left" />
          <div className="goal right" />
        </div>

        {homePlayers.map(([left, top], index) => (
          <div
            className={`player home p${index}`}
            style={{ left: `${left}%`, top: `${top}%`, ...teamStyle(teams.home.colors) }}
            key={`home-${index}`}
          ><span>{index + 1}</span></div>
        ))}
        {awayPlayers.map(([left, top], index) => (
          <div
            className={`player away p${index}`}
            style={{ left: `${left}%`, top: `${top}%`, ...teamStyle(teams.away.colors) }}
            key={`away-${index}`}
          ><span>{index + 6}</span></div>
        ))}
        <div className={`ball ${running ? 'is-moving' : ''}`} style={ballTarget}>⚽</div>
      </div>

      <div className="match-callout">
        <span className="pulse-icon" />
        <div><small>YORUM GÜCÜ · {teams.home.shortName} {votes.home} / {teams.away.shortName} {votes.away}</small><strong>{lastActor ? `${lastActor} oyunu kullandı!` : `Takımını seç: ${teams.home.command} veya ${teams.away.command}`}</strong></div>
      </div>
    </div>
  )
}
