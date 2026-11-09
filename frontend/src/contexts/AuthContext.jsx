import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('focusflow_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('focusflow_token')
    if (token) {
      authApi.me()
        .then((res) => {
          setUser(res.data)
          localStorage.setItem('focusflow_user', JSON.stringify(res.data))
        })
        .catch(() => {
          localStorage.removeItem('focusflow_token')
          localStorage.removeItem('focusflow_user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authApi.login({ email, password })
    const { access_token } = res.data
    localStorage.setItem('focusflow_token', access_token)
    const meRes = await authApi.me()
    setUser(meRes.data)
    localStorage.setItem('focusflow_user', JSON.stringify(meRes.data))
    return meRes.data
  }

  const register = async (email, password, display_name) => {
    const res = await authApi.register({ email, password, display_name })
    return res.data
  }

  const logout = async () => {
    try { await authApi.logout() } catch {}
    localStorage.removeItem('focusflow_token')
    localStorage.removeItem('focusflow_user')
    setUser(null)
  }

  const updateUser = (updated) => {
    setUser(updated)
    localStorage.setItem('focusflow_user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
