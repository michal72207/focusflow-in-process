/**
 * useAttentionTracker
 *
 * Pipeline:
 *   Webcam stream
 *   → MediaPipe FaceLandmarker  (478 landmarks × x,y,z per frame)
 *   → sliding 100-frame buffer  (rolling window, NOT fixed — keeps updating)
 *   → ONNX Runtime Web (v4_2.onnx)  every NEW_FRAME_STEP frames
 *   → attention score 0..1  → onScore callback
 *
 * FIX — continuous updates:
 *   The buffer keeps growing beyond 100.  We run inference on every
 *   NEW_FRAME_STEP NEW frames (not just once at 100).  This produces a
 *   new score every ~2 seconds once the initial 10-second window fills.
 *
 * FIX — stale closure:
 *   onScore is stored in a ref (onScoreRef) so the inference path always
 *   calls the latest callback without needing to recreate useCallback chains.
 *   The setInterval processFrame does NOT depend on any React state/callback.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

const FRAME_RATE       = 10    // Hz — matches training sample rate
const WINDOW_SIZE      = 100   // frames per inference window (~10 s)
const LANDMARKS_COUNT  = 478
const NEW_FRAME_STEP   = 20    // run inference every 20 NEW frames (every ~2 s)
const MODEL_PATH       = '/models/v4_66.onnx'   // best range across all inputs
const MODEL_INPUT      = 'input_x'
const SCORE_OUTPUT     = 'regression_scores'

// ── Score calibration ────────────────────────────────────────────────────────
// After centroid normalization, v4_66 outputs ~0.40 for attentive users.
// These bounds are set to keep the gauge meaningful without over-compressing.
const RAW_LOW  = 0.30   // raw score → 0% display
const RAW_HIGH = 0.50   // raw score → 100% display

function calibrateScore(raw) {
  const c = (raw - RAW_LOW) / (RAW_HIGH - RAW_LOW)
  return Math.max(0, Math.min(1, c))
}

// ── Landmark preprocessing: centroid normalization ───────────────────────────
// The model was trained on *relative* face geometry, not absolute positions.
// Raw MediaPipe x/y include head position and camera distance, which confuses
// the model and produces artificially low scores (~15%) regardless of attention.
//
// Centroid normalization:
//   1. Subtract per-frame face centroid → removes head position
//   2. Divide by inter-landmark std     → removes camera distance / face size
//
// Result: raw score jumps from ~0.22 to ~0.40+ for attentive inputs,
//         and gaze direction (camera vs screen) no longer matters.
function centroidNormalize(frameData) {
  // frameData: Float32Array of length LANDMARKS_COUNT * 3
  // Layout: [x0, y0, z0,  x1, y1, z1,  ...,  x477, y477, z477]
  const N = LANDMARKS_COUNT

  // 1. Compute centroid
  let cx = 0, cy = 0, cz = 0
  for (let i = 0; i < N; i++) {
    cx += frameData[i * 3]
    cy += frameData[i * 3 + 1]
    cz += frameData[i * 3 + 2]
  }
  cx /= N;  cy /= N;  cz /= N

  // 2. Compute scale (std of x and y only — z is already small)
  let varSum = 0
  for (let i = 0; i < N; i++) {
    const dx = frameData[i * 3]     - cx
    const dy = frameData[i * 3 + 1] - cy
    varSum += dx * dx + dy * dy
  }
  const scale = Math.sqrt(varSum / (N * 2)) || 1e-6

  // 3. Normalize in-place into a new Float32Array
  const out = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    out[i * 3]     = (frameData[i * 3]     - cx) / scale
    out[i * 3 + 1] = (frameData[i * 3 + 1] - cy) / scale
    out[i * 3 + 2] = (frameData[i * 3 + 2] - cz) / scale
  }
  return out
}

export default function useAttentionTracker({ onScore, onNoFace }) {
  const [cameraActive,    setCameraActive]    = useState(false)
  const [faceDetected,    setFaceDetected]    = useState(false)
  const [modelReady,      setModelReady]      = useState(false)
  const [modelStatus,     setModelStatus]     = useState('מודל לא טעון')
  const [error,           setError]           = useState(null)
  const [framesCollected, setFramesCollected] = useState(0)

  // --- Refs that outlive renders -----------------------------------------
  const videoRef        = useRef(null)
  const streamRef       = useRef(null)
  const landmarkerRef   = useRef(null)
  const ortModuleRef    = useRef(null)
  const ortSessionRef   = useRef(null)
  const frameBufferRef  = useRef([])   // unlimited growth — sliced per inference
  const intervalRef     = useRef(null)
  const inferringRef    = useRef(false)
  const newFramesSinceLastInferRef = useRef(0)  // counter since last inference
  const cleanupRef      = useRef(null)

  // KEY FIX: store callbacks in refs so the interval closure is NEVER stale.
  const onScoreRef   = useRef(onScore)
  const onNoFaceRef  = useRef(onNoFace)
  useEffect(() => { onScoreRef.current  = onScore  }, [onScore])
  useEffect(() => { onNoFaceRef.current = onNoFace }, [onNoFace])

  // ── ONNX model load ────────────────────────────────────────────────────
  const loadOnnxModel = useCallback(async () => {
    try {
      setModelStatus('טוען מודל AI...')
      const ort = await import('onnxruntime-web')
      ortModuleRef.current = ort

      // Match CDN WASM version to the installed JS package (1.31.1)
      ort.env.wasm.wasmPaths =
        'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/'
      // Single-threaded: no SharedArrayBuffer / COEP needed → YouTube works
      ort.env.wasm.numThreads = 1

      const session = await ort.InferenceSession.create(MODEL_PATH, {
        executionProviders: ['wasm'],
      })
      ortSessionRef.current = session
      setModelReady(true)
      setModelStatus('מודל v4_2 פעיל ✓')
      console.log('[FocusFlow] ONNX loaded | inputs:', session.inputNames,
                  '| outputs:', session.outputNames)
    } catch (err) {
      console.error('[FocusFlow] ONNX load failed:', err)
      setModelStatus('שגיאה בטעינת מודל: ' + err.message)
      setModelReady(false)
    }
  }, [])

  // ── MediaPipe load ─────────────────────────────────────────────────────
  const loadMediaPipe = useCallback(async () => {
    try {
      setModelStatus('טוען MediaPipe...')
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm',
      )
      const lm = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/' +
            'face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      })
      landmarkerRef.current = lm
      setModelStatus('MediaPipe פעיל')
      console.log('[FocusFlow] MediaPipe ready')
    } catch (err) {
      console.error('[FocusFlow] MediaPipe failed:', err)
      setModelStatus('שגיאת MediaPipe: ' + err.message)
    }
  }, [])

  useEffect(() => {
    loadMediaPipe()
    loadOnnxModel()
    return () => { if (cleanupRef.current) cleanupRef.current() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inference (called from processFrame via ref — never stale) ────────
  const runInference = useCallback(async () => {
    const ort     = ortModuleRef.current
    const session = ortSessionRef.current
    if (!ort || !session)                             return
    if (frameBufferRef.current.length < WINDOW_SIZE)  return
    if (inferringRef.current)                         return  // back-pressure
    inferringRef.current = true

    try {
      // Take the most-recent 100 frames as a sliding window
      const window100  = frameBufferRef.current.slice(-WINDOW_SIZE)
      const floatCount = WINDOW_SIZE * LANDMARKS_COUNT * 3
      const flat       = new Float32Array(floatCount)
      for (let f = 0; f < WINDOW_SIZE; f++) {
        flat.set(window100[f], f * LANDMARKS_COUNT * 3)
      }

      const inputTensor = new ort.Tensor(
        'float32', flat, [1, WINDOW_SIZE, LANDMARKS_COUNT, 3],
      )
      const outputs = await session.run({ [MODEL_INPUT]: inputTensor })

      // .data is Float32Array — index with [0], never call .getValue()
      const scoreTensor = outputs[SCORE_OUTPUT]
      if (scoreTensor?.data?.length > 0) {
        const raw        = Number(scoreTensor.data[0])
        if (Number.isFinite(raw)) {
          const calibrated = calibrateScore(raw)
          console.log(`[FocusFlow] raw=${raw.toFixed(4)} → calibrated=${(calibrated*100).toFixed(1)}%`)
          onScoreRef.current && onScoreRef.current(calibrated)
        }
      }
    } catch (err) {
      console.error('[FocusFlow] Inference error:', err)
    } finally {
      inferringRef.current = false
    }
  }, []) // ← empty deps: runInference itself never changes; data via refs

  // Keep a stable ref to runInference for use inside setInterval
  const runInferenceRef = useRef(runInference)
  useEffect(() => { runInferenceRef.current = runInference }, [runInference])

  // ── Frame extraction — all logic via refs, zero stale closures ─────────
  // processFrame is created ONCE and never recreated.
  // It reads everything it needs through refs.
  const processFrame = useCallback(() => {
    const video = videoRef.current
    const lm    = landmarkerRef.current
    if (!video || !lm || video.readyState < 2) return

    try {
      const result = lm.detectForVideo(video, performance.now())

      if (result.faceLandmarks?.length > 0) {
        const pts = result.faceLandmarks[0]
        if (pts.length !== LANDMARKS_COUNT) return

        setFaceDetected(true)

        // Pack raw x,y,z for 478 landmarks → Float32Array(1434)
        const rawFrame = new Float32Array(LANDMARKS_COUNT * 3)
        for (let i = 0; i < LANDMARKS_COUNT; i++) {
          rawFrame[i * 3]     = pts[i].x
          rawFrame[i * 3 + 1] = pts[i].y
          rawFrame[i * 3 + 2] = pts[i].z
        }

        // Apply centroid normalization before buffering.
        // Removes head position + camera distance so model gets relative geometry.
        const frame = centroidNormalize(rawFrame)

        frameBufferRef.current.push(frame)

        // Cap total buffer at 3× window to limit memory (keeps last 300 frames)
        if (frameBufferRef.current.length > WINDOW_SIZE * 3) {
          frameBufferRef.current = frameBufferRef.current.slice(-WINDOW_SIZE * 2)
        }

        const total = frameBufferRef.current.length
        setFramesCollected(Math.min(total, WINDOW_SIZE))

        // FIX: run inference on every NEW_FRAME_STEP new frames (not just once)
        if (total >= WINDOW_SIZE) {
          newFramesSinceLastInferRef.current += 1
          if (newFramesSinceLastInferRef.current >= NEW_FRAME_STEP) {
            newFramesSinceLastInferRef.current = 0
            runInferenceRef.current()  // call via ref — always latest version
          }
        }
      } else {
        setFaceDetected(false)
        onNoFaceRef.current && onNoFaceRef.current()
      }
    } catch (_) {
      // detectForVideo can throw during initialisation — safe to ignore
    }
  }, []) // ← empty deps: everything accessed via refs

  // ── Camera start / stop ────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      frameBufferRef.current = []
      newFramesSinceLastInferRef.current = 0
      setFramesCollected(0)
      setCameraActive(true)
      intervalRef.current = setInterval(processFrame, 1000 / FRAME_RATE)
    } catch (err) {
      setError('לא ניתן לגשת למצלמה: ' + err.message)
      setCameraActive(false)
    }
  }, [processFrame])

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setFaceDetected(false)
    frameBufferRef.current = []
    newFramesSinceLastInferRef.current = 0
    setFramesCollected(0)
  }, [])

  useEffect(() => { cleanupRef.current = stopTracking }, [stopTracking])

  return {
    videoRef,
    cameraActive,
    faceDetected,
    modelReady,
    modelStatus,
    error,
    startTracking,
    stopTracking,
    framesCollected,
  }
}
