import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('focusflow_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('focusflow_token')
      localStorage.removeItem('focusflow_user')
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
}

// ── Content ───────────────────────────────────────────────────────────────────
export const contentApi = {
  list: () => api.get('/api/content'),
  get: (id) => api.get(`/api/content/${id}`),
  create: (data) => api.post('/api/content', data),
  update: (id, data) => api.patch(`/api/content/${id}`, data),
  delete: (id) => api.delete(`/api/content/${id}`),
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionApi = {
  start: (contentId) => api.post('/api/sessions', { content_id: contentId }),
  addReading: (sessionId, position, score) =>
    api.post(`/api/sessions/${sessionId}/readings`, { position, score }),
  end: (sessionId) => api.post(`/api/sessions/${sessionId}/end`),
  list: () => api.get('/api/sessions'),
  get: (id) => api.get(`/api/sessions/${id}`),
}

// ── Questions ─────────────────────────────────────────────────────────────────
export const questionsApi = {
  get: (contentId) => api.get(`/api/questions/${contentId}`),
  generate: (contentId) => api.post(`/api/questions/${contentId}/generate`),
  answer: (questionId, answer) => api.post(`/api/questions/${questionId}/answer`, { question_id: questionId, answer }),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  personal: () => api.get('/api/analytics/personal'),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe: () => api.get('/api/users/me'),
  updateMe: (display_name) => api.patch('/api/users/me', { display_name }),
  changePassword: (current_password, new_password) =>
    api.post('/api/users/me/password', { current_password, new_password }),
  deleteAccount: () => api.delete('/api/users/me'),
}

export default api
