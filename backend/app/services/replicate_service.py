import asyncio
import logging
import mimetypes
import os
import time
import uuid
from typing import Optional

import httpx

import replicate
from replicate.exceptions import ReplicateError

from app.config import settings
from app.models.outfit import JobStatus

logger = logging.getLogger(__name__)

FLUX_DEV_MODEL   = "black-forest-labs/flux-dev"
IDM_VTON_VERSION = "906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f"

_STYLE_CONTEXT = {
    "fashion editorial": (
        "plain pure white seamless studio backdrop, "
        "soft even diffused studio lighting from the front, no harsh shadows"
    ),
    "outdoor lifestyle": (
        "bright outdoor park setting, open shade natural daylight, "
        "soft even illumination, no direct harsh sunlight"
    ),
    "street style": (
        "clean urban sidewalk background, soft natural daylight, "
        "even illumination, minimal background distractions"
    ),
}

# Prompt ottimizzato per IDM-VTON: posa frontale, braccia leggermente staccate,
# abbigliamento base neutro che IDM-VTON può facilmente rilevare e sostituire.
_BASE_HUMAN_PROMPT = (
    "Full body portrait photograph of a {gender_descriptor}, "
    "standing perfectly upright facing directly toward the camera, "
    "feet flat on the ground hip-width apart, "
    "both arms relaxed and hanging slightly away from the body sides, "
    "wearing a plain white fitted t-shirt and plain light gray fitted trousers, "
    "{style_context}, "
    "entire body visible from top of head to feet, "
    "sharp focus on the full figure, photorealistic, "
    "natural skin texture, realistic facial features, neutral expression, "
    "eyes looking straight into the camera lens, "
    "no accessories, no jewelry, no bag, "
    "professional fashion catalog photography, 8k resolution"
)


def _get_replicate_client():
    return replicate.Client(api_token=settings.REPLICATE_API_TOKEN)


def _run_with_retry_sync(client, model: str, input_data: dict, max_retries: int = 4):
    """Sincrono con retry su 429 — chiamare via asyncio.to_thread."""
    for attempt in range(max_retries):
        try:
            return client.run(model, input=input_data)
        except ReplicateError as e:
            if e.status == 429 and attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                logger.warning("Replicate 429 — riprovo tra %ds (tentativo %d/%d)", wait, attempt + 1, max_retries)
                time.sleep(wait)
            else:
                raise


async def generate_base_model(
    prompt: Optional[str] = None,
    gender: str = "female",
    style: str = "fashion editorial",
) -> dict:
    gender_descriptor = {"female": "young woman", "male": "young man", "neutral": "person"}.get(
        gender, "person"
    )
    style_context = _STYLE_CONTEXT.get(style, _STYLE_CONTEXT["fashion editorial"])
    final_prompt = prompt or _BASE_HUMAN_PROMPT.format(
        gender_descriptor=gender_descriptor,
        style_context=style_context,
    )

    logger.info("Generazione figura base (FLUX): gender=%s style=%s", gender, style)

    client = _get_replicate_client()

    try:
        output = await asyncio.to_thread(
            _run_with_retry_sync,
            client,
            FLUX_DEV_MODEL,
            {
                "prompt": final_prompt,
                "aspect_ratio": "2:3",   # più verticale — figura intera senza ritagli
                "num_inference_steps": 50,
                "guidance": 3.0,
                "output_format": "jpg",
                "go_fast": False,        # qualità massima, disabilita fp8
            },
        )

        raw = output[0] if isinstance(output, list) else output
        image_url = str(raw)
        if not image_url.startswith("http"):
            raise ValueError(f"URL non valido restituito da FLUX: {image_url!r}")
        logger.info("Figura base generata: %s", image_url)

        return {
            "status": JobStatus.COMPLETED.value,
            "image_url": image_url,
            "prompt_used": final_prompt,
        }
    except Exception as e:
        logger.exception("Errore generazione figura base")
        return {"status": JobStatus.FAILED.value, "error": str(e)}


async def _download_and_save(url: str, save_dir: str) -> str:
    """Scarica un'immagine da URL e la salva localmente. Restituisce il path relativo."""
    os.makedirs(save_dir, exist_ok=True)
    ext = url.split("?")[0].rsplit(".", 1)[-1]
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(save_dir, filename)
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url)
        response.raise_for_status()
        with open(filepath, "wb") as f:
            f.write(response.content)
    return filepath


def _upload_file_sync(client, file_path: str) -> str:
    """Carica un file locale su Replicate e restituisce l'URL pubblico."""
    content_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
    with open(file_path, "rb") as f:
        uploaded = client.files.create(f, filename=os.path.basename(file_path), content_type=content_type)
    return uploaded.urls["get"]


def _create_tryon_prediction_sync(client, input_data: dict, max_retries: int = 4):
    """Crea prediction IDM-VTON con retry su 429 — sincrono, da chiamare via to_thread."""
    for attempt in range(max_retries):
        try:
            return client.predictions.create(version=IDM_VTON_VERSION, input=input_data)
        except ReplicateError as e:
            if e.status == 429 and attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                logger.warning("Replicate 429 — riprovo tra %ds (tentativo %d/%d)", wait, attempt + 1, max_retries)
                time.sleep(wait)
            else:
                raise


async def _apply_single_garment(client, human_img_url: str, garment_path: str, category: str = "top") -> str:
    """Applica un singolo capo tramite IDM-VTON. Restituisce l'URL risultante."""
    logger.info("Upload capo (%s): %s", category, garment_path)
    garment_url = await asyncio.to_thread(_upload_file_sync, client, garment_path)

    prediction = await asyncio.to_thread(
        _create_tryon_prediction_sync,
        client,
        {
            "human_img":       human_img_url,
            "garm_img":        garment_url,
            "garment_des":     category,
            "is_checked":      True,
            "is_checked_crop": False,
            "denoise_steps":   30,
            "seed":            42,
        },
    )

    logger.info("Prediction creata: %s", prediction.id)

    while prediction.status not in ("succeeded", "failed", "canceled"):
        await asyncio.sleep(3)
        await asyncio.to_thread(prediction.reload)
        logger.debug("Try-on status: %s", prediction.status)

    if prediction.status != "succeeded":
        raise Exception(f"Prediction fallita: {prediction.error}")

    output = prediction.output
    raw = output[0] if isinstance(output, list) else output
    return str(raw)


async def apply_virtual_tryon(
    model_image_url: str,
    garment_items: list[dict],
) -> dict:
    """
    Applica più capi in sequenza (chaining) tramite IDM-VTON.
    garment_items: lista di {image_path, description} in ordine di applicazione.
    Scarica e salva il risultato finale in uploads/tryon/.
    """
    logger.info("Avvio virtual try-on: %d capi", len(garment_items))

    client = _get_replicate_client()

    try:
        current_url = model_image_url

        for i, item in enumerate(garment_items):
            logger.info("Applico capo %d/%d: %s (%s)", i + 1, len(garment_items), item["description"][:40], item.get("category", "top"))
            current_url = await _apply_single_garment(
                client,
                current_url,
                item["image_path"],
                item.get("category", "top"),
            )

        logger.info("Try-on completato, salvo immagine...")
        saved_path = await _download_and_save(current_url, "uploads/tryon")
        logger.info("Immagine salvata: %s", saved_path)

        return {
            "status": JobStatus.COMPLETED.value,
            "image_url": current_url,
            "image_path": saved_path,
        }

    except Exception as e:
        logger.exception("Errore virtual try-on")
        return {"status": JobStatus.FAILED.value, "error": str(e)}
