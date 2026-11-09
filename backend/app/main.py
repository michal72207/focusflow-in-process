"""FocusFlow FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import connect_db, close_db
from .routes import auth, users, contents, sessions, questions, analytics

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("Starting FocusFlow backend...")
    await connect_db()
    logger.info("Backend ready.")
    yield
    logger.info("Shutting down...")
    await close_db()


settings = get_settings()

app = FastAPI(
    title="FocusFlow API",
    description="Attention tracking learning platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the frontend container and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check (exact path required by assignment)
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(contents.router)
app.include_router(sessions.router)
app.include_router(questions.router)
app.include_router(analytics.router)
