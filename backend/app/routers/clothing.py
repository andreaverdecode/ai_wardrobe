import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.clothing import ClothingItem, ClothingCategory
from app.schemas.clothing import (
    ClothingItemResponse,
    ClothingItemListResponse,
    ClothingItemUpdate,
    ClothingUploadResponse,
)
from app.services.claude_service import analyze_clothing_item
from app.utils.file_utils import (
    validate_upload_file,
    save_upload_file,
    file_to_base64,
    get_image_media_type,
    delete_file_if_exists,
)
from app.utils.user_utils import get_or_create_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clothing", tags=["clothing"])


@router.post("/upload", response_model=ClothingUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_clothing_item(
    file: UploadFile = File(...),
    user_id: str = Query(...),
    name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Carica un'immagine di un capo, la salva, genera thumbnail e avvia l'analisi Claude.
    Il nome viene dedotto dall'AI se non fornito esplicitamente.
    """
    get_or_create_user(user_id, db)
    validate_upload_file(file)

    image_path, thumbnail_path = await save_upload_file(file, subfolder="clothing")

    # Analisi Claude automatica
    analysis_performed = False
    analysis_result = None

    if image_path:
        try:
            image_b64 = file_to_base64(image_path)
            media_type = get_image_media_type(image_path)
            analysis_result = await analyze_clothing_item(image_b64, file.filename or "", media_type)
            analysis_performed = True
        except Exception:
            logger.exception("Analisi Claude fallita per %s, procedo senza metadati AI", image_path)

    item_name = name
    if not item_name and analysis_result:
        # Componi un nome leggibile dalla categoria e colore se non fornito
        color = analysis_result.get("color", "")
        category = analysis_result.get("category", "capo")
        item_name = f"{color} {category}".strip().title() if color else category.title()
    if not item_name:
        item_name = file.filename or "Nuovo capo"

    item = ClothingItem(
        user_id=user_id,
        name=item_name,
        image_path=image_path,
        thumbnail_path=thumbnail_path,
        category=analysis_result.get("category", "top") if analysis_result else "top",
        garment_type=analysis_result.get("garment_type") if analysis_result else None,
        color=analysis_result.get("color") if analysis_result else None,
        colors=analysis_result.get("colors") if analysis_result else None,
        pattern=analysis_result.get("pattern") if analysis_result else None,
        style_tags=analysis_result.get("style_tags") if analysis_result else None,
        season=analysis_result.get("season") if analysis_result else None,
        brand=analysis_result.get("brand") if analysis_result else None,
        material=analysis_result.get("material") if analysis_result else None,
        occasion=analysis_result.get("occasion") if analysis_result else None,
        ai_description=analysis_result.get("description") if analysis_result else None,
        ai_metadata=analysis_result if analysis_result else None,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return ClothingUploadResponse(
        item=ClothingItemResponse.model_validate(item),
        analysis_performed=analysis_performed,
        message="Capo aggiunto con analisi AI" if analysis_performed else "Capo aggiunto senza analisi AI",
    )


@router.get("", response_model=ClothingItemListResponse)
def list_clothing_items(
    user_id: str = Query(...),
    category: Optional[ClothingCategory] = Query(None),
    season: Optional[str] = Query(None),
    color: Optional[str] = Query(None),
    style_tag: Optional[str] = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lista tutti i capi attivi con filtri opzionali per categoria, stagione, colore e stile."""
    query = db.query(ClothingItem).filter(
        ClothingItem.user_id == user_id,
        ClothingItem.is_active.is_(True),
    )

    if category:
        query = query.filter(ClothingItem.category == category)

    # Filtri su campi JSON: SQLite supporta json_each tramite func ma per semplicità
    # usiamo LIKE — per PostgreSQL si userebbe json_contains o @>
    if season:
        query = query.filter(ClothingItem.season.contains(season))
    if color:
        query = query.filter(ClothingItem.color.ilike(f"%{color}%"))
    if style_tag:
        query = query.filter(ClothingItem.style_tags.contains(style_tag))

    total = query.count()
    items = query.order_by(ClothingItem.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return ClothingItemListResponse(
        items=[ClothingItemResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{item_id}", response_model=ClothingItemResponse)
def get_clothing_item(item_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    item = _get_item_or_404(item_id, user_id, db)
    return ClothingItemResponse.model_validate(item)


@router.put("/{item_id}", response_model=ClothingItemResponse)
def update_clothing_item(
    item_id: str,
    updates: ClothingItemUpdate,
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(item_id, user_id, db)

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return ClothingItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing_item(item_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    """Soft delete: imposta is_active=False invece di rimuovere il record."""
    item = _get_item_or_404(item_id, user_id, db)
    item.is_active = False
    db.commit()


@router.post("/{item_id}/analyze", response_model=ClothingItemResponse)
async def reanalyze_clothing_item(
    item_id: str, user_id: str = Query(...), db: Session = Depends(get_db)
):
    """Ri-esegue l'analisi Claude su un capo già caricato."""
    item = _get_item_or_404(item_id, user_id, db)

    if not item.image_path:
        raise HTTPException(status_code=400, detail="Nessuna immagine associata al capo")

    image_b64 = file_to_base64(item.image_path)
    media_type = get_image_media_type(item.image_path)

    analysis_result = await analyze_clothing_item(image_b64, item.name, media_type)

    item.category = analysis_result.get("category", item.category)
    item.garment_type = analysis_result.get("garment_type", item.garment_type)
    item.color = analysis_result.get("color", item.color)
    item.colors = analysis_result.get("colors", item.colors)
    item.pattern = analysis_result.get("pattern", item.pattern)
    item.style_tags = analysis_result.get("style_tags", item.style_tags)
    item.season = analysis_result.get("season", item.season)
    item.brand = analysis_result.get("brand", item.brand)
    item.material = analysis_result.get("material", item.material)
    item.occasion = analysis_result.get("occasion", item.occasion)
    item.ai_description = analysis_result.get("description", item.ai_description)
    item.ai_metadata = analysis_result

    db.commit()
    db.refresh(item)
    return ClothingItemResponse.model_validate(item)


def _get_item_or_404(item_id: str, user_id: str, db: Session) -> ClothingItem:
    item = (
        db.query(ClothingItem)
        .filter(
            ClothingItem.id == item_id,
            ClothingItem.user_id == user_id,
            ClothingItem.is_active.is_(True),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Capo non trovato")
    return item
