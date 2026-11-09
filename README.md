# FocusFlow — Power Tech 2026

אתר למידה חכם שמודד קשב בזמן אמת דרך מצלמת הרשת.

## הרצה מהירה

```bash
# 1. העתק קובץ סביבה
cp .env.example .env

# 2. הפעל Docker Desktop

# 3. הרץ
docker compose up --build
```

| שירות | כתובת |
|-------|-------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |

## מודל AI

הקובץ `frontend/public/models/v4_66.onnx` **לא נמצא ב-git** (גדול מדי).  
יש להעתיק אותו ידנית מהתיקייה `focusflow-models/` לפני ה-build:

```bash
cp ../focusflow-models/v4_66.onnx frontend/public/models/
```

## מבנה הפרויקט

```
focusflow/
├── backend/          # FastAPI + Python
│   └── app/
│       ├── routes/   # auth, content, sessions, questions, analytics
│       ├── schemas/  # Pydantic models
│       └── utils/    # security (JWT, bcrypt)
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/    # Login, Library, Viewer, History, Analytics...
│       ├── hooks/    # useAttentionTracker (MediaPipe + ONNX)
│       └── components/
├── docker-compose.yml
├── .env.example
└── PROJECT_INFO.docx
```

## טכנולוגיות

- **Backend:** Python 3.11, FastAPI, Motor (MongoDB async), JWT, bcrypt
- **Frontend:** React 18, Vite, onnxruntime-web, @mediapipe/tasks-vision, Recharts
- **DB:** MongoDB 7.0 (Docker)
- **AI Model:** v4_66.onnx (GRU+Attention, runs in browser via WASM)

## Variables סביבה (.env)

```
MONGODB_URI=mongodb://mongo:27017
DB_NAME=focusflow
JWT_SECRET=<change-this>
GEMINI_API_KEY=          # optional – enables AI questions
```
