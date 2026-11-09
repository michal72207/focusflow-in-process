"""MongoDB connection and collection helpers."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import get_settings
import logging

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db():
    global _client, _db
    settings = get_settings()
    logger.info(f"Connecting to MongoDB at {settings.mongodb_uri}")
    _client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    _db = _client[settings.db_name]
    # Verify connection
    await _client.admin.command("ping")
    logger.info("MongoDB connected successfully")
    await _create_indexes()


async def _create_indexes():
    """Create necessary indexes on startup."""
    try:
        await _db["users"].create_index("email", unique=True)
        await _db["contents"].create_index("user_id")
        await _db["sessions"].create_index("user_id")
        await _db["sessions"].create_index([("user_id", 1), ("content_id", 1)])
        await _db["questions"].create_index("content_id")
        logger.info("Database indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


async def close_db():
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency: returns the database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
