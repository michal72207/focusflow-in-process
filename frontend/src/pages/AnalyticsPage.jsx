import React, { useState, useEffect } from 'react'
import { analyticsApi } from '../services/api'
import Navbar from '../components/Navbar'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import './AnalyticsPage.css'

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await analyticsApi.personal()
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">טוען...</div></div>

  const timeline = (data?.sessions_timeline || []).slice(0, 30).reverse()
  const chartData = timeline.map((s, i) => ({
    name: `#${i + 1}`,
    score: s.average_score !== null ? Math.round(s.average_score * 100) : null,
    date: new Date(s.started_at).toLocaleDateString('he-IL'),
  })).filter(d => d.score !== null)

  const overallPct = data?.overall_average_score != null ? Math.round(data.overall_average_score * 100) : null

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <h1 className="page-title">האנליטיקה שלי</h1>

        {data?.total_sessions === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <h2>אין נתונים עדיין</h2>
            <p>השלם סשן לימוד ראשון כדי לראות אנליטיקה</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="analytics-stats">
              <div className="stat-card">
                <div className="stat-value primary">{overallPct !== null ? `${overallPct}%` : '—'}</div>
                <div className="stat-label">ממוצע קשב כולל</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{data?.total_sessions || 0}</div>
                <div className="stat-label">סשנים</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{data?.total_readings || 0}</div>
                <div className="stat-label">מדידות</div>
              </div>
            </div>

            {/* Attention trend */}
            {chartData.length > 1 && (
              <div className="analytics-chart-card">
                <h2>מגמת קשב לאורך הסשנים</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={12} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, 'ממוצע קשב']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.date || label}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4f46e5' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bar chart */}
            {chartData.length > 0 && (
              <div className="analytics-chart-card">
                <h2>ציוני קשב לפי סשן</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} />
                    <Tooltip formatter={(v) => [`${v}%`, 'קשב']} />
                    <Bar dataKey="score" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent sessions list */}
            <div className="recent-sessions">
              <h2>סשנים אחרונים</h2>
              {(data?.sessions_timeline || []).slice(0, 10).map((s, i) => (
                <div key={s.session_id} className="recent-session-row">
                  <span className="session-num">#{i + 1}</span>
                  <span className="session-date">{new Date(s.started_at).toLocaleDateString('he-IL')}</span>
                  <span className="session-readings">{s.reading_count} מדידות</span>
                  <span className={`score-badge ${
                    s.average_score >= 0.7 ? 'high' : s.average_score >= 0.4 ? 'medium' : 'low'
                  }`}>
                    {s.average_score !== null ? `${Math.round(s.average_score * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
