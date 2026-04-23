from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from routes import novels, auth
import os

os.makedirs("./static/covers", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Novel Reader API", lifespan=lifespan)

# Same-origin in production (Mini App served from the same domain as the API via nginx),
# so CORS is rarely hit. Keep the Mini App domain + Telegram WebView origins explicit.
# Note: "*" combined with allow_credentials=True is invalid per the CORS spec — browsers reject it.
_allowed_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "https://bookcatalogue.space,https://www.bookcatalogue.space",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="./static"), name="static")

app.include_router(novels.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
