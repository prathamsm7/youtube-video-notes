import os

from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not all([QDRANT_URL, QDRANT_API_KEY]):
    raise RuntimeError(
        "Missing required env vars: QDRANT_URL, QDRANT_API_KEY. "
        "Please set them in your .env file."
    )

qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=60,
)
