import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { contentApi } from '../services/api'
import Navbar from '../components/Navbar'
import './LibraryPage.css'

const CONTENT_TYPES = [
  { value: 'youtube', label: 'סרטון YouTube', placeholder: 'https://www.youtube.com/watch?v=...' },
  { value: 'text', label: 'טקסט', placeholder: 'הדבק כאן טקסט ארוך לקריאה...' },
  { value: 'web', label: 'דף אינטרנט', placeholder: 'https://example.com/article' },
]

const TYPE_ICONS = { youtube: '▶️', text: '📄', web: '🌐' }
const TYPE_LABELS = { youtube: 'YouTube', text: 'טקסט', web: 'דף אינטרנט' }

export default function LibraryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'youtube', source: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchItems() }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await contentApi.list()
      setItems(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      await contentApi.create(form)
      setForm({ title: '', type: 'youtube', source: '' })
      setShowForm(false)
      fetchItems()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setFormError(detail.map(d => d.msg).join(', '))
      } else {
        setFormError(detail || 'שגיאה בהוספת פריט')
      }
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await contentApi.delete(id)
      setDeleteConfirm(null)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const selectedType = CONTENT_TYPES.find(t => t.value === form.type)

  return (
    <div className="page-layout">
      <Navbar />
      <main className="page-content">
        <div className="library-header">
          <div>
            <h1>הספרייה שלי</h1>
            <p className="page-subtitle">{items.length} פריטים</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'ביטול' : '+ הוסף תוכן'}
          </button>
        </div>

        {showForm && (
          <div className="add-form-card">
            <h2>הוספת פריט תוכן</h2>
            <form onSubmit={handleAdd} className="add-form">
              <div className="form-row">
                <div className="form-group">
                  <label>כותרת</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="שם הפריט"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>סוג תוכן</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, source: '' }))}>
                    {CONTENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>{form.type === 'text' ? 'תוכן הטקסט' : 'קישור'}</label>
                {form.type === 'text' ? (
                  <textarea
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    placeholder={selectedType?.placeholder}
                    required
                    rows={4}
                  />
                ) : (
                  <input
                    type="url"
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    placeholder={selectedType?.placeholder}
                    required
                    dir="ltr"
                  />
                )}
              </div>
              {formError && <div className="auth-error">{formError}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? 'מוסיף...' : 'הוסף לספרייה'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-state">טוען ספרייה...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📚</span>
            <h2>הספרייה ריקה</h2>
            <p>הוסף את הפריט הראשון שלך כדי להתחיל ללמוד</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ הוסף תוכן</button>
          </div>
        ) : (
          <div className="content-grid">
            {items.map(item => (
              <div key={item.id} className="content-card">
                <div className="card-type-badge">
                  <span>{TYPE_ICONS[item.type]}</span>
                  <span>{TYPE_LABELS[item.type]}</span>
                </div>
                <h3 className="card-title">{item.title}</h3>
                <p className="card-source">{item.source.substring(0, 60)}{item.source.length > 60 ? '...' : ''}</p>
                <div className="card-actions">
                  <button className="btn-primary btn-sm" onClick={() => navigate(`/viewer/${item.id}`)}>
                    פתח ולמד
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => setDeleteConfirm(item.id)}>
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <h3>מחיקת פריט</h3>
              <p>האם אתה בטוח שברצונך למחוק פריט זה? לא ניתן לשחזר.</p>
              <div className="modal-actions">
                <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>מחק</button>
                <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>ביטול</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
