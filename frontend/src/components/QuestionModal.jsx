import React, { useState } from 'react'
import { questionsApi } from '../services/api'
import './QuestionModal.css'

export default function QuestionModal({ questions, onClose }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const q = questions[current]

  const handleAnswer = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const res = await questionsApi.answer(q.id, selected)
      setResult(res.data)
    } catch {
      setResult({ correct: selected === q.correct_answer, correct_answer: q.correct_answer, explanation: '' })
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1)
      setSelected(null)
      setResult(null)
    } else {
      onClose()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="question-modal" role="dialog" aria-modal="true" aria-labelledby="question-title">
        <div className="question-header">
          <div className="question-badge">
            <span>⚡ רמת קשב ירדה</span>
          </div>
          <span className="question-counter">{current + 1} / {questions.length}</span>
        </div>

        <p className="question-prompt" id="question-title">{q.question_text}</p>

        <div className="options-list">
          {q.options.map((opt, i) => {
            let cls = 'option'
            if (result) {
              if (opt === result.correct_answer) cls += ' correct'
              else if (opt === selected && !result.correct) cls += ' wrong'
            } else if (opt === selected) {
              cls += ' selected'
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => !result && setSelected(opt)}
                disabled={!!result}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {result && (
          <div className={`feedback ${result.correct ? 'feedback-correct' : 'feedback-wrong'}`}>
            <strong>{result.correct ? '✅ נכון!' : '❌ לא נכון'}</strong>
            {result.explanation && <p>{result.explanation}</p>}
          </div>
        )}

        <div className="question-actions">
          {!result ? (
            <>
              <button className="btn-primary" onClick={handleAnswer} disabled={!selected || loading}>
                {loading ? 'בודק...' : 'שלח תשובה'}
              </button>
              <button className="btn-secondary" onClick={onClose}>המשך ללמוד</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={handleNext}>
                {current < questions.length - 1 ? 'שאלה הבאה' : 'סיים וחזור ללמוד'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
