import os
from dotenv import load_dotenv
from upstash_redis import Redis

load_dotenv()
REDIS_URL = os.environ.get("UPSTASH_REDIS_REST_URL")
REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
print(REDIS_URL)

try:
    if REDIS_URL and REDIS_TOKEN:
        redis_client = Redis(url=REDIS_URL, token=REDIS_TOKEN)
        redis_client.set("test_key", "hello")
        val = redis_client.get("test_key")
        print("Redis success:", val)
    else:
        print("Missing creds")
except Exception as e:
    print("Error:", e)
