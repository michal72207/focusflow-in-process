import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { sessionApi, contentApi } from '../services/api'
import Navbar from '../components/Navbar'
import './HistoryPage.css'

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="score-badge neutral">—</span>
  const pct = Math.round(score * 100)
  const cls = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return <span className={`score-badge ${cls}`}>{pct}%</span>
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState([])
  const [contents, setContents] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sessRes, contRes] = await Promise.all([
        sessionApi.list(),
        contentApi.list(),
      ])
      setSessions(sessRes.data)
      const map = {}
      contRes.data.forEach(c => { map[c.id] = c })
      setContents(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-title">היסטוריית למידה</h1>

        {loading ? (
          <div className="loading-state">טוען...</div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h2>אין סשנים עדיין</h2>
            <p>התחל לימוד כדי לראות את ההיסטוריה שלך</p>
            <Link to="/library" className="btn-primary">עבור לספרייה</Link>
          </div>
        ) : (
          <div className="sessions-table-wrapper">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>תוכן</th>
                  <th>תאריך</th>
                  <th>מדידות</th>
                  <th>ממוצע קשב</th>
                  <th>סטטוס</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const content = contents[s.content_id]
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="session-content-name">
                          {content ? content.title : <span className="muted">תוכן לא זמין</span>}
                        </div>
                        {content && <div className="session-content-type">{content.type}</div>}
                      </td>
                      <td className="date-cell">{formatDate(s.started_at)}</td>
                      <td>{s.reading_count}</td>
                      <td><ScoreBadge score={s.average_score} /></td>
                      <td>
                        <span className={`status-badge ${s.ended_at ? 'ended' : 'active'}`}>
                          {s.ended_at ? 'הסתיים' : 'פעיל'}
                        </span>
                      </td>
                      <td>
                        <Link to={`/sessions/${s.id}`} className="btn-link">פרטים</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
