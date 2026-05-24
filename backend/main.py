import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine
from app.models import user, clothing, outfit  # noqa: F401 — importa i modelli per registrarli su Base
from app.database import Base
from app.routers import clothing_router, outfits_router, tryon_router

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Avvio %s", settings.APP_NAME)
    Base.metadata.create_all(bind=engine)
    logger.info("Tabelle DB create/verificate")

    # Assicura che la directory uploads esista
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    yield

    # Shutdown
    logger.info("Spegnimento %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API per la gestione del guardaroba con analisi AI e virtual try-on",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False,
)

# CORS — in produzione restringi CORS_ORIGINS al dominio del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router API
app.include_router(clothing_router, prefix="/api/v1")
app.include_router(outfits_router, prefix="/api/v1")
app.include_router(tryon_router, prefix="/api/v1")

# Serve le immagini caricate come file statici
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "0.1.0",
    }
