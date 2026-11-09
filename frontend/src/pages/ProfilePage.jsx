import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usersApi } from '../services/api'
import Navbar from '../components/Navbar'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [nameMsg, setNameMsg] = useState('')
  const [nameLoading, setNameLoading] = useState(false)

  const [passwords, setPasswords] = useState({ current: '', new_pass: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState({ text: '', ok: false })
  const [pwLoading, setPwLoading] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleUpdateName = async (e) => {
    e.preventDefault()
    setNameLoading(true)
    setNameMsg('')
    try {
      const res = await usersApi.updateMe(displayName)
      updateUser(res.data)
      setNameMsg('שם עודכן בהצלחה!')
    } catch (err) {
      setNameMsg(err.response?.data?.detail || 'שגיאה בעדכון')
    } finally {
      setNameLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwMsg({ text: '', ok: false })
    if (passwords.new_pass !== passwords.confirm) {
      setPwMsg({ text: 'הסיסמאות אינן תואמות', ok: false })
      return
    }
    if (passwords.new_pass.length < 8) {
      setPwMsg({ text: 'הסיסמה חייבת להיות לפחות 8 תווים', ok: false })
      return
    }
    setPwLoading(true)
    try {
      await usersApi.changePassword(passwords.current, passwords.new_pass)
      setPwMsg({ text: 'הסיסמה שונתה בהצלחה!', ok: true })
      setPasswords({ current: '', new_pass: '', confirm: '' })
    } catch (err) {
      setPwMsg({ text: err.response?.data?.detail || 'שגיאה בשינוי סיסמה', ok: false })
    } finally {
      setPwLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    try {
      await usersApi.deleteAccount()
      await logout()
      navigate('/login')
    } catch (e) {
      console.error(e)
      setDeleteLoading(false)
    }
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content profile-content">
        <h1 className="page-title">הפרופיל שלי</h1>

        {/* User info */}
        <div className="profile-card">
          <div className="profile-avatar">{user?.display_name?.[0]?.toUpperCase()}</div>
          <div className="profile-info">
            <div className="profile-name">{user?.display_name}</div>
            <div className="profile-email">{user?.email}</div>
          </div>
        </div>

        {/* Update display name */}
        <div className="settings-card">
          <h2>עדכון שם תצוגה</h2>
          <form onSubmit={handleUpdateName} className="settings-form">
            <div className="form-group">
              <label>שם תצוגה</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
            {nameMsg && <div className="success-msg">{nameMsg}</div>}
            <button type="submit" className="btn-primary" disabled={nameLoading}>
              {nameLoading ? 'שומר...' : 'עדכן שם'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="settings-card">
          <h2>שינוי סיסמה</h2>
          <form onSubmit={handleChangePassword} className="settings-form">
            <div className="form-group">
              <label>סיסמה נוכחית</label>
              <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required dir="ltr" />
            </div>
            <div className="form-group">
              <label>סיסמה חדשה</label>
              <input type="password" value={passwords.new_pass} onChange={e => setPasswords(p => ({ ...p, new_pass: e.target.value }))} required dir="ltr" placeholder="לפחות 8 תווים" />
            </div>
            <div className="form-group">
              <label>אימות סיסמה חדשה</label>
              <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required dir="ltr" />
            </div>
            {pwMsg.text && (
              <div className={pwMsg.ok ? 'success-msg' : 'auth-error'}>{pwMsg.text}</div>
            )}
            <button type="submit" className="btn-primary" disabled={pwLoading}>
              {pwLoading ? 'משנה...' : 'שנה סיסמה'}
            </button>
          </form>
        </div>

        {/* Delete account */}
        <div className="settings-card danger-zone">
          <h2>מחיקת חשבון</h2>
          <p>מחיקת החשבון תמחק לצמיתות את כל הנתונים שלך כולל תכנים, סשנים ומדידות.</p>
          <button className="btn-danger" onClick={() => setShowDelete(true)}>מחק חשבון</button>
        </div>

        {showDelete && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>⚠️ מחיקת חשבון</h3>
              <p>פעולה זו <strong>אינה ניתנת לביטול</strong>. כל הנתונים שלך יימחקו לצמיתות.</p>
              <div className="modal-actions">
                <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                  {deleteLoading ? 'מוחק...' : 'כן, מחק את החשבון שלי'}
                </button>
                <button className="btn-secondary" onClick={() => setShowDelete(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
