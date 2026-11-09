import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { sessionApi, contentApi } from '../services/api'
import Navbar from '../components/Navbar'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import './SessionDetailPage.css'

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('he-IL')
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return '-'
  const s = Math.floor((new Date(endIso) - new Date(startIso)) / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function SessionDetailPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { loadData() }, [sessionId])

  const loadData = async () => {
    try {
      const res = await sessionApi.get(sessionId)
      setSession(res.data)
      if (res.data.content_id) {
        try {
          const cRes = await contentApi.get(res.data.content_id)
          setContent(cRes.data)
        } catch {}
      }
    } catch (e) {
      if (e.response?.status === 404) setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">טוען...</div></div>
  if (notFound) return (
    <div className="page-layout">
      <Navbar />
      <div className="not-found">
        <h2>לא נמצא</h2>
        <p>הסשן אינו קיים או שאינו שלך.</p>
        <Link to="/history" className="btn-primary">חזור להיסטוריה</Link>
      </div>
    </div>
  )

  const readings = session?.readings || []
  const scores = readings.map(r => r.score)
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const faceCount = readings.filter(r => r.score > 0).length

  const chartData = readings.map((r, i) => ({
    index: i + 1,
    score: Math.round(r.score * 100),
    position: r.position,
  }))

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <div className="session-detail-header">
          <button className="btn-back" onClick={() => navigate('/history')}>← חזור</button>
          <h1>סיכום סשן</h1>
        </div>

        {/* Stats row */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{avg !== null ? `${Math.round(avg * 100)}%` : '—'}</div>
            <div className="stat-label">ממוצע קשב</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatDuration(session?.started_at, session?.ended_at)}</div>
            <div className="stat-label">משך הסשן</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{readings.length}</div>
            <div className="stat-label">מדידות</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {readings.length > 0 ? `${Math.round((faceCount / readings.length) * 100)}%` : '—'}
            </div>
            <div className="stat-label">פנים זוהו</div>
          </div>
        </div>

        {/* Content info */}
        {content && (
          <div className="content-info-card">
            <strong>תוכן:</strong> {content.title}
            <span className="content-type-tag">{content.type}</span>
          </div>
        )}

        {/* Attention chart */}
        {chartData.length > 0 ? (
          <div className="chart-card">
            <h2>גרף קשב לאורך הסשן</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="index" label={{ value: 'מדידה', position: 'insideBottom', offset: -4 }} fontSize={12} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={12} />
                <Tooltip formatter={(v) => [`${v}%`, 'קשב']} />
                <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'סף', position: 'right', fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="chart-card empty">
            <p>אין נתוני מדידה לסשן זה.</p>
          </div>
        )}

        {/* Time info */}
        <div className="time-info">
          <div><span>התחלה:</span> <strong>{formatDate(session?.started_at)}</strong></div>
          <div><span>סיום:</span> <strong>{formatDate(session?.ended_at)}</strong></div>
        </div>
      </main>
    </div>
  )
}
