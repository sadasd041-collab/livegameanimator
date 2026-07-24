import { useMemo } from 'react'
import { questions } from '../data'

type QuizGameProps = {
  round: number
  progress: number
  votes: [number, number, number, number]
  continuous?: boolean
}

export function QuizGame({ round, progress, votes, continuous = false }: QuizGameProps) {
  const item = useMemo(() => questions[round % questions.length], [round])
  const answered = progress < 24
  const totalVotes = votes.reduce((sum, value) => sum + value, 0)

  return (
    <div className="quiz-scene">
      <div className="quiz-orbit orbit-one" />
      <div className="quiz-orbit orbit-two" />
      <div className="quiz-topline">
        <span>{item.category.toUpperCase()}</span>
        <strong>{continuous ? 'KESİNTİSİZ' : `SORU ${round + 7}`}</strong>
      </div>

      <div className="quiz-timer">
        <div className="timer-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
          <span>{Math.max(1, Math.ceil(progress / 10))}</span>
        </div>
        <small>CEVAP SÜRESİ</small>
      </div>

      <h2>{item.question}</h2>
      <div className="answer-grid">
        {item.answers.map((answer, index) => (
          <div className={`answer-card ${answered && index === item.correct ? 'correct' : ''}`} key={answer}>
            <span>{String.fromCharCode(65 + index)}</span>
            <strong>{answer}</strong>
            <em>{totalVotes ? Math.round((votes[index] / totalVotes) * 100) : 0}%</em>
          </div>
        ))}
      </div>
      <div className="quiz-footer">
        <span>💬 Cevabını sohbete yaz</span>
        <span className="viewer-answer">{totalVotes} cevap</span>
      </div>
    </div>
  )
}
