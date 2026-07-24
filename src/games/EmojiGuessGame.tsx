import { emojiPuzzles } from '../data'

type EmojiGuessGameProps = {
  round: number
  attempts: number
  winners: string[]
  progress: number
  continuous?: boolean
}

export function EmojiGuessGame({ round, attempts, winners, progress, continuous = false }: EmojiGuessGameProps) {
  const puzzle = emojiPuzzles[round % emojiPuzzles.length]
  const revealed = progress < 24 || winners.length > 0

  return (
    <div className="emoji-scene">
      <div className="emoji-glow one" />
      <div className="emoji-glow two" />
      <div className="emoji-heading"><small>EMOJİ ŞİFRESİ</small><strong>{continuous ? 'KESİNTİSİZ' : `TUR ${round + 1}`}</strong></div>
      <div className="emoji-puzzle">{puzzle.emoji}</div>
      <div className="clue-row">{puzzle.clues.map((clue) => <span key={clue}>{clue}</span>)}</div>
      <div className={`answer-reveal ${revealed ? 'visible' : ''}`}>
        <small>CEVAP</small><strong>{revealed ? puzzle.answer.toLocaleUpperCase('tr-TR') : '••••••••'}</strong>
      </div>
      <div className="game-live-stats">
        <span>💬 {attempts} tahmin</span>
        <span>🏆 {winners[0] || 'İlk doğru cevabı bekliyor'}</span>
      </div>
    </div>
  )
}
