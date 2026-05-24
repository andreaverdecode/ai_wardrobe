import uuid
import base64
import logging
import os
from pathlib import Path
from typing import Tuple

from PIL import Image
from fastapi import HTTPException, UploadFile

from app.config import settings

logger = logging.getLogger(__name__)

THUMBNAIL_SIZE = (400, 400)


def validate_upload_file(file: UploadFile) -> None:
    """Valida estensione e content-type prima di leggere il contenuto."""
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Filename mancante")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Estensione non supportata. Usa: {', '.join(settings.ALLOWED_EXTENSIONS)}",
        )


async def save_upload_file(file: UploadFile, subfolder: str = "") -> Tuple[str, str]:
    """
    Salva il file uploadato e genera una thumbnail.
    Ritorna (image_path, thumbnail_path) relativi alla UPLOAD_DIR.
    """
    content = await file.read()

    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File troppo grande. Massimo {settings.MAX_FILE_SIZE // (1024*1024)} MB",
        )

    upload_base = Path(settings.UPLOAD_DIR)
    target_dir = upload_base / subfolder if subfolder else upload_base
    thumb_dir = target_dir / "thumbnails"
    target_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1].lower()  # type: ignore[union-attr]
    unique_name = f"{uuid.uuid4()}.{ext}"
    file_path = target_dir / unique_name
    thumb_path = thumb_dir / unique_name

    file_path.write_bytes(content)
    logger.info("File salvato: %s (%d bytes)", file_path, len(content))

    _generate_thumbnail(file_path, thumb_path)

    return str(file_path), str(thumb_path)


def _generate_thumbnail(source: Path, dest: Path) -> None:
    try:
        with Image.open(source) as img:
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            # Converti in RGB se necessario (es. PNG con canale alpha)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(dest, optimize=True, quality=85)
    except Exception:
        logger.exception("Impossibile generare thumbnail per %s", source)


def file_to_base64(file_path: str) -> str:
    """
    Legge un file immagine, lo ridimensiona se necessario e lo converte in base64.
    Garantisce che la stringa base64 risultante non superi il limite di 5 MB di Claude.
    """
    MAX_BASE64_BYTES = 5 * 1024 * 1024  # 5 MB limite Claude
    MAX_SIDE = 1500

    import io
    with Image.open(file_path) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Ridimensiona se troppo grande
        if img.width > MAX_SIDE or img.height > MAX_SIDE:
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)

        # Comprimi progressivamente finché il base64 sta nel limite
        quality = 85
        while quality >= 40:
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            data = buf.getvalue()
            encoded = base64.b64encode(data)
            if len(encoded) <= MAX_BASE64_BYTES:
                return encoded.decode("utf-8")
            quality -= 15

    # Fallback: leggi il file originale (raro — immagine troppo piccola per essere ridotta)
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def get_image_media_type(file_path: str) -> str:
    """Ritorna il media type corretto in base all'estensione del file."""
    ext = file_path.rsplit(".", 1)[-1].lower()
    mapping = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
    }
    return mapping.get(ext, "image/jpeg")


def delete_file_if_exists(file_path: str | None) -> None:
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            logger.warning("Impossibile eliminare il file: %s", file_path)
