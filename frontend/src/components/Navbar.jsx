import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/library" className="brand-link">
          <span className="brand-icon">🎯</span>
          <span className="brand-name">FocusFlow</span>
        </Link>
      </div>

      <div className="navbar-links">
        <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`}>
          ספרייה
        </Link>
        <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
          היסטוריה
        </Link>
        <Link to="/analytics" className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}>
          אנליטיקה
        </Link>
      </div>

      <div className="navbar-user">
        <Link to="/profile" className="user-name">{user?.display_name}</Link>
        <button onClick={handleLogout} className="btn-logout">התנתקות</button>
      </div>
    </nav>
  )
}
