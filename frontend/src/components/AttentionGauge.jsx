import React from 'react'
import './AttentionGauge.css'

const LEVELS = [
  // Thresholds calibrated for centroid-normalized v4_66 inputs.
  // Attentive screen-viewing yields ~65–90% after normalization.
  { max: 0.20, label: 'לא זוהו פנים', color: '#94a3b8', bg: '#f8fafc' },
  { max: 0.40, label: 'לא קשוב',      color: '#ef4444', bg: '#fef2f2' },
  { max: 0.58, label: 'קשב חלש',      color: '#f97316', bg: '#fff7ed' },
  { max: 0.75, label: 'קשוב',         color: '#eab308', bg: '#fefce8' },
  { max: 1.01, label: 'קשוב מאוד',    color: '#22c55e', bg: '#f0fdf4' },
]

export function getAttentionLevel(score) {
  if (score === null || score === undefined) return null
  return LEVELS.find(l => score < l.max) || LEVELS[LEVELS.length - 1]
}

export default function AttentionGauge({ score, faceDetected, cameraActive, modelStatus }) {
  const level = score !== null && score !== undefined ? getAttentionLevel(score) : null

  const pct = score !== null && score !== undefined ? Math.round(score * 100) : null

  // Arc path calculation
  const radius = 70
  const cx = 90
  const cy = 90
  const startAngle = -210
  const endAngle = 30
  const totalAngle = endAngle - startAngle

  const toRad = (deg) => (deg * Math.PI) / 180
  const arcX = (angle) => cx + radius * Math.cos(toRad(angle))
  const arcY = (angle) => cy + radius * Math.sin(toRad(angle))

  const bgPath = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${radius} ${radius} 0 1 1 ${arcX(endAngle)} ${arcY(endAngle)}`

  const filledAngle = score !== null ? startAngle + totalAngle * score : startAngle
  const filledPath = score !== null
    ? `M ${arcX(startAngle)} ${arcY(startAngle)} A ${radius} ${radius} 0 ${Math.abs(filledAngle - startAngle) > 180 ? 1 : 0} 1 ${arcX(filledAngle)} ${arcY(filledAngle)}`
    : null

  return (
    <div className="attention-gauge">
      <div className="gauge-title">רמת קשב</div>

      <div className="gauge-arc-container">
        <svg width="180" height="120" viewBox="0 0 180 120">
          {/* Background arc */}
          <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
          {/* Filled arc */}
          {filledPath && (
            <path
              d={filledPath}
              fill="none"
              stroke={level?.color || '#94a3b8'}
              strokeWidth="12"
              strokeLinecap="round"
              style={{ transition: 'all 0.5s ease' }}
            />
          )}
          {/* Center text */}
          <text x="90" y="88" textAnchor="middle" fontSize="28" fontWeight="700" fill={level?.color || '#94a3b8'}>
            {pct !== null ? `${pct}%` : '—'}
          </text>
        </svg>
      </div>

      {/* Status indicators */}
      <div className="gauge-indicators">
        <div className={`indicator ${cameraActive ? 'on' : 'off'}`}>
          <span className="indicator-dot" />
          <span>{cameraActive ? 'מצלמה פעילה' : 'מצלמה כבויה'}</span>
        </div>

        {cameraActive && (
          <div className={`indicator ${faceDetected ? 'on' : 'warn'}`}>
            <span className="indicator-dot" />
            <span>{faceDetected ? 'פנים זוהו' : 'לא זוהו פנים'}</span>
          </div>
        )}

        {modelStatus && (
          <div className="indicator info">
            <span className="indicator-dot" />
            <span>{modelStatus}</span>
          </div>
        )}
      </div>

      {/* Level badge */}
      {level && score !== null && (
        <div className="gauge-level-badge" style={{ background: level.bg, color: level.color }}>
          {level.label}
        </div>
      )}

      {!cameraActive && (
        <div className="gauge-hint">הפעל מצלמה למדידת קשב</div>
      )}
    </div>
  )
}
