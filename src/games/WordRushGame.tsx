import { wordPuzzles } from '../data'

type WordRushGameProps = {
  round: number
  attempts: number
  winners: string[]
  progress: number
  continuous?: boolean
}

export function WordRushGame({ round, attempts, winners, progress, continuous = false }: WordRushGameProps) {
  const puzzle = wordPuzzles[round % wordPuzzles.length]
  const solved = winners.length > 0 || progress < 22

  return (
    <div className="word-scene">
      <div className="word-heading"><small>KELİME AVI · {puzzle.category.toLocaleUpperCase('tr-TR')}</small><strong>{continuous ? 'KESİNTİSİZ' : `${wordPuzzles.length} KELİME`}</strong></div>
      <p>{puzzle.hint}</p>
      <div className="scrambled-word">
        {puzzle.scrambled.split(' ').map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
      </div>
      <div className={`word-result ${solved ? 'solved' : ''}`}>
        <small>{solved ? 'DOĞRU CEVAP' : 'YORUMA KELİMEYİ YAZ'}</small>
        <strong>{solved ? puzzle.answer.toLocaleUpperCase('tr-TR') : [...puzzle.answer].map(() => '•').join(' ')}</strong>
      </div>
      <div className="game-live-stats">
        <span>⚡ {attempts} deneme</span>
        <span>🏆 {winners[0] || 'Kazanan aranıyor'}</span>
      </div>
    </div>
  )
}
