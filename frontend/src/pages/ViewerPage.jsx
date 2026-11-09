/**
 * ViewerPage — FocusFlow content viewer with live attention tracking.
 *
 * Layout: full-viewport no-scroll split-screen dashboard
 *   Left  (flex:1):   video / text / web content
 *   Right (300 px):   camera preview, gauge, frame counter, model status
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { contentApi, sessionApi, questionsApi } from '../services/api'
import Navbar from '../components/Navbar'
import AttentionGauge from '../components/AttentionGauge'
import useAttentionTracker from '../hooks/useAttentionTracker'
import QuestionModal from '../components/QuestionModal'
import './ViewerPage.css'

const ATTENTION_THRESHOLD = 0.40
const ALERT_COOLDOWN_MS   = 90_000   // 90s minimum between prompts

// How many consecutive low-attention readings before triggering a prompt.
// Each reading comes every ~2 s (NEW_FRAME_STEP=20 at 10fps).
// 4 readings × 2s = ~8 seconds of continuous low attention before popup.
const CONSECUTIVE_LOW_NEEDED = 4

// ─────────────────────────────────────────────────────────────────────────────
// YouTube URL → embed URL
// Supports: watch?v=ID  |  youtu.be/ID  |  /embed/ID  |  /shorts/ID
// Falls back to the original src if no valid ID is found.
// ─────────────────────────────────────────────────────────────────────────────
function toYoutubeEmbedUrl(src) {
  if (!src) return ''

  // Regex-based extraction — no URL constructor needed, works for any format
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,   // raw 11-char ID
  ]

  for (const re of patterns) {
    const m = src.match(re)
    if (m && m[1]) {
      const id = m[1]
      return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`
    }
  }

  // Already an embed URL? Return as-is.
  if (src.includes('youtube.com/embed/')) return src

  // Unknown format — return unchanged (iframe will show its own error)
  return src
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ViewerPage() {
  const { contentId } = useParams()
  const navigate      = useNavigate()

  const [content,          setContent]          = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [notFound,         setNotFound]         = useState(false)
  const [session,          setSession]          = useState(null)
  const [sessionActive,    setSessionActive]    = useState(false)
  const [ending,           setEnding]           = useState(false)
  const [score,            setScore]            = useState(null)
  const [position,         setPosition]         = useState(0)
  const [interactiveMode,  setInteractiveMode]  = useState(false)
  const [showQuestion,     setShowQuestion]     = useState(false)
  const [questions,        setQuestions]        = useState([])
  const [showCameraPrompt, setShowCameraPrompt] = useState(false)

  const lastAlertRef         = useRef(0)
  const sessionRef           = useRef(null)
  const positionRef          = useRef(0)
  const interactiveModeRef   = useRef(false)
  const consecutiveLowRef    = useRef(0)    // counts consecutive low-attention readings

  useEffect(() => { sessionRef.current       = session        }, [session])
  useEffect(() => { positionRef.current      = position       }, [position])
  useEffect(() => { interactiveModeRef.current = interactiveMode }, [interactiveMode])

  // ── Score callback ─────────────────────────────────────────────────────────
  const handleScore = useCallback(async (newScore) => {
    setScore(newScore)
    const activeSession = sessionRef.current
    if (!activeSession) return

    // Persist every reading to backend
    try {
      await sessionApi.addReading(activeSession.id, positionRef.current, newScore)
    } catch (_) { /* non-fatal */ }

    // Interactive mode: require CONSECUTIVE_LOW_NEEDED consecutive low scores
    // before triggering a popup — avoids reacting to a single brief dip.
    if (interactiveModeRef.current) {
      if (newScore < ATTENTION_THRESHOLD) {
        consecutiveLowRef.current += 1
      } else {
        consecutiveLowRef.current = 0   // reset on any good reading
      }

      if (consecutiveLowRef.current >= CONSECUTIVE_LOW_NEEDED) {
        const now = Date.now()
        if (now - lastAlertRef.current > ALERT_COOLDOWN_MS) {
          lastAlertRef.current = now
          consecutiveLowRef.current = 0  // reset after triggering
          setShowQuestion(true)
        }
      }
    } else {
      // Interactive mode OFF: silently reset the counter
      consecutiveLowRef.current = 0
    }
  }, [])

  const handleNoFace = useCallback(() => {}, [])

  const tracker = useAttentionTracker({ onScore: handleScore, onNoFace: handleNoFace })

  // ── Load content ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setScore(null)
    contentApi.get(contentId)
      .then(res => setContent(res.data))
      .catch(e  => { if (e.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
    return () => tracker.stopTracking()
  }, [contentId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session lifecycle ───────────────────────────────────────────────────────
  const startSession = async () => {
    try {
      const res = await sessionApi.start(contentId)
      setSession(res.data)
      setSessionActive(true)
      setShowCameraPrompt(true)
    } catch (e) { console.error('[Viewer] start session:', e) }
  }

  const enableCamera = async () => {
    setShowCameraPrompt(false)
    await tracker.startTracking()
  }

  const endSession = async () => {
    if (!sessionRef.current || ending) return
    setEnding(true)
    tracker.stopTracking()
    try {
      await sessionApi.end(sessionRef.current.id)
      navigate(`/sessions/${sessionRef.current.id}`)
    } catch (e) {
      console.error('[Viewer] end session:', e)
      setEnding(false)
    }
  }

  // ── Questions (interactive mode) ────────────────────────────────────────────
  useEffect(() => {
    if (!interactiveMode) return
    questionsApi.get(contentId)
      .then(res => {
        if (res.data.questions?.length) return setQuestions(res.data.questions)
        return questionsApi.generate(contentId).then(r => setQuestions(r.data.questions || []))
      })
      .catch(console.error)
  }, [interactiveMode, contentId])

  // ── Loading / not-found guards ──────────────────────────────────────────────
  if (loading) return (
    <div className="vp-shell">
      <Navbar />
      <div className="vp-center-msg">טוען...</div>
    </div>
  )

  if (notFound) return (
    <div className="vp-shell">
      <Navbar />
      <div className="vp-center-msg">
        <h2>לא נמצא</h2>
        <p>הפריט אינו קיים או שאינו שלך.</p>
        <button className="vp-btn-primary" onClick={() => navigate('/library')}>חזור לספרייה</button>
      </div>
    </div>
  )

  const embedUrl = content?.type === 'youtube' ? toYoutubeEmbedUrl(content.source) : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="vp-shell">
      <Navbar />

      <div className="vp-dashboard">

        {/* ══ MAIN COLUMN ══════════════════════════════════════════════════════ */}
        <div className="vp-main">

          {/* Top bar */}
          <div className="vp-topbar">
            <span className="vp-title" title={content?.title}>{content?.title}</span>
            <span className={`vp-chip vp-chip--${content?.type}`}>{content?.type}</span>

            {!sessionActive ? (
              <button className="vp-btn-start" onClick={startSession}>▶ התחל סשן</button>
            ) : (
              <div className="vp-session-controls">
                <span className="vp-live-dot" aria-hidden="true" />
                <span className="vp-live-label">סשן פעיל</span>
                <label className="vp-mode-toggle">
                  <input
                    type="checkbox"
                    checked={interactiveMode}
                    onChange={e => setInteractiveMode(e.target.checked)}
                  />
                  שאלות אוטומטיות
                </label>
                <button className="vp-btn-end" onClick={endSession} disabled={ending}>
                  {ending ? 'מסיים...' : '■ סיים סשן'}
                </button>
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="vp-content">

            {/* ── NO FACE BANNER — visible, bold, covering the top of the content ── */}
            {tracker.cameraActive && !tracker.faceDetected && (
              <div className="vp-no-face-banner" role="alert" aria-live="assertive">
                <span className="vp-no-face-icon">👤</span>
                <span className="vp-no-face-text">לא זוהו פנים — כוון את הפנים למצלמה</span>
              </div>
            )}
            {content?.type === 'youtube' && (
              <iframe
                className="vp-yt-iframe"
                src={embedUrl}
                title={content.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}

            {content?.type === 'text' && (
              <div className="vp-text-body">
                {content.source.split('\n').map((para, i) =>
                  para.trim() ? <p key={i}>{para}</p> : <br key={i} />
                )}
              </div>
            )}

            {content?.type === 'web' && (
              <div className="vp-web-card">
                <span className="vp-web-icon">🌐</span>
                <strong className="vp-web-title">{content.title}</strong>
                <span className="vp-web-url" dir="ltr">{content.source}</span>
                <p className="vp-web-hint">פתח בכרטיסייה נפרדת — המצלמה תמשיך לפעול כאן.</p>
                <a href={content.source} target="_blank" rel="noopener noreferrer"
                   className="vp-btn-primary">פתח דף ↗</a>
              </div>
            )}
          </div>
        </div>

        {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
        <aside className="vp-sidebar">

          {/* Camera */}
          <div className="vp-sb-card">
            <p className="vp-sb-label">📷 מצלמה</p>
            <div className="vp-cam-wrap">
              <video
                ref={tracker.videoRef}
                className={`vp-cam-video${tracker.cameraActive ? '' : ' off'}`}
                autoPlay muted playsInline
                aria-label="תצוגת מצלמה"
              />
              {!tracker.cameraActive && (
                <div className="vp-cam-overlay">
                  {sessionActive
                    ? <button className="vp-btn-cam" onClick={() => setShowCameraPrompt(true)}>הפעל מצלמה</button>
                    : <span className="vp-cam-hint">מצלמה כבויה</span>
                  }
                </div>
              )}
            </div>
            {tracker.error && <p className="vp-cam-err">{tracker.error}</p>}
          </div>

          {/* Gauge */}
          <AttentionGauge
            score={score}
            faceDetected={tracker.faceDetected}
            cameraActive={tracker.cameraActive}
            modelStatus={tracker.modelStatus}
          />

          {/* Frame counter */}
          {tracker.cameraActive && (
            <div className="vp-sb-card">
              <div className="vp-frames-row">
                <span className="vp-sb-label">איסוף</span>
                <span className="vp-frames-num">
                  {Math.min(tracker.framesCollected, 100)}
                  <span className="vp-frames-of">/100</span>
                </span>
              </div>
              <div className="vp-bar-track">
                <div className="vp-bar-fill"
                     style={{ width: `${Math.min(tracker.framesCollected, 100)}%` }} />
              </div>
              {tracker.framesCollected < 100 && (
                <p className="vp-frames-hint">
                  עוד ~{Math.ceil((100 - tracker.framesCollected) / FRAME_RATE)} שנ׳ לציון הראשון
                </p>
              )}
            </div>
          )}

          {/* Model status */}
          <div className={`vp-sb-card vp-model-status${tracker.modelReady ? ' ready' : ''}`}>
            <span className="vp-model-dot" />
            <span className="vp-model-text">{tracker.modelStatus}</span>
          </div>

        </aside>
      </div>

      {/* ── Camera consent modal ── */}
      {showCameraPrompt && (
        <div className="vp-modal-bg" onClick={() => setShowCameraPrompt(false)}>
          <div className="vp-modal" onClick={e => e.stopPropagation()}>
            <h3>📷 הפעלת מצלמה</h3>
            <p>
              FocusFlow צריך גישה למצלמה כדי למדוד קשב.<br /><br />
              <strong>מה נאסף:</strong> נקודות פנים בלבד (478 × x,y,z).
              הווידאו <strong>לא</strong> עוזב את הדפדפן.
            </p>
            <div className="vp-modal-actions">
              <button className="vp-btn-primary" onClick={enableCamera}>אני מסכים/ה</button>
              <button className="vp-btn-secondary" onClick={() => setShowCameraPrompt(false)}>לא עכשיו</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive question modal ── */}
      {showQuestion && questions.length > 0 && (
        <QuestionModal questions={questions} onClose={() => setShowQuestion(false)} />
      )}
    </div>
  )
}

// Expose FRAME_RATE so frame-hint calculation is consistent
const FRAME_RATE = 10
