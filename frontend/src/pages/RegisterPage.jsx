import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthPages.css'

export default function RegisterPage() {
  const [form, setForm] = useState({ display_name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('הסיסמאות אינן תואמות')
      return
    }
    if (form.password.length < 8) {
      setError('הסיסמה חייבת להיות לפחות 8 תווים')
      return
    }

    setLoading(true)
    try {
      await register(form.email, form.password, form.display_name)
      // Auto-login after registration
      await login(form.email, form.password)
      navigate('/library')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 409) {
        setError('האימייל הזה כבר רשום במערכת')
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(', '))
      } else {
        setError(detail || 'שגיאה בהרשמה. נסה שנית.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🎯</span>
          <h1>FocusFlow</h1>
          <p>למד בריכוז מלא</p>
        </div>

        <h2 className="auth-title">הרשמה</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="display_name">שם תצוגה</label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              value={form.display_name}
              onChange={handleChange}
              placeholder="השם שיוצג בפרופיל"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">אימייל</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              dir="ltr"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">סיסמה</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="לפחות 8 תווים"
              required
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm">אימות סיסמה</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              value={form.confirm}
              onChange={handleChange}
              placeholder="הזן שוב את הסיסמה"
              required
              dir="ltr"
            />
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'נרשם...' : 'הרשמה'}
          </button>
        </form>

        <p className="auth-switch">
          כבר יש לך חשבון?{' '}
          <Link to="/login">התחבר כאן</Link>
        </p>
      </div>
    </div>
  )
}
