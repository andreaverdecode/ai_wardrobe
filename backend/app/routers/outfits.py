import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.clothing import ClothingItem
from app.models.outfit import Outfit, OutfitItem
from app.schemas.outfit import (
    OutfitResponse,
    OutfitListResponse,
    OutfitGenerateRequest,
    OutfitGenerateResponse,
)
from app.services.claude_service import generate_outfit_suggestions
from app.services.outfit_service import create_outfit_from_suggestion
from app.utils.user_utils import get_or_create_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/outfits", tags=["outfits"])


@router.post("/generate", response_model=OutfitGenerateResponse, status_code=status.HTTP_201_CREATED)
async def generate_outfits(
    request: OutfitGenerateRequest,
    db: Session = Depends(get_db),
):
    """
    Recupera i metadati del guardaroba dell'utente e chiede a Claude
    di generare suggerimenti di outfit. Salva automaticamente gli outfit generati.
    """
    get_or_create_user(request.user_id, db)
    query = db.query(ClothingItem).filter(
        ClothingItem.user_id == request.user_id,
        ClothingItem.is_active.is_(True),
    )

    if request.clothing_item_ids:
        query = query.filter(ClothingItem.id.in_(request.clothing_item_ids))

    clothing_items = query.all()

    if not clothing_items:
        raise HTTPException(
            status_code=400,
            detail="Nessun capo trovato nel guardaroba. Carica prima alcuni vestiti.",
        )

    if len(clothing_items) < 2:
        raise HTTPException(
            status_code=400,
            detail="Servono almeno 2 capi per generare un outfit.",
        )

    # Serializza i metadati per Claude
    items_metadata = [
        {
            "id": item.id,
            "name": item.name,
            "category": item.category.value,
            "color": item.color,
            "colors": item.colors or [],
            "pattern": item.pattern.value if item.pattern else None,
            "style_tags": item.style_tags or [],
            "season": item.season or [],
            "occasion": item.occasion or [],
            "material": item.material,
        }
        for item in clothing_items
    ]

    # Preferenze utente: potrebbe essere arricchito caricando il profilo utente dal DB
    user_preferences = {"user_id": request.user_id}

    suggestions = await generate_outfit_suggestions(
        clothing_items_metadata=items_metadata,
        user_preferences=user_preferences,
        occasion=request.occasion,
        season=request.season,
        count=request.count,
    )

    # Valida che i clothing_item_ids nei suggerimenti siano reali
    valid_ids = {item.id for item in clothing_items}
    saved_outfits = []
    seen_combinations: set[frozenset] = set()  # deduplicazione per combinazione di ID

    for suggestion in suggestions:
        # Filtra ID non validi (allucinazioni di Claude)
        suggestion["clothing_item_ids"] = [
            iid for iid in suggestion.get("clothing_item_ids", []) if iid in valid_ids
        ]
        suggestion["outfit_items"] = [
            oi for oi in suggestion.get("outfit_items", [])
            if oi.get("clothing_item_id") in valid_ids
        ]

        if not suggestion["clothing_item_ids"]:
            logger.warning("Suggerimento scartato: nessun ID valido — %s", suggestion.get("name"))
            continue

        # Scarta duplicati (stessa combinazione di capi)
        combo_key = frozenset(suggestion["clothing_item_ids"])
        if combo_key in seen_combinations:
            logger.warning("Suggerimento scartato: combinazione duplicata — %s", suggestion.get("name"))
            continue
        seen_combinations.add(combo_key)

        # Scarta outfit con score basso (Claude a volte ignora la soglia)
        if suggestion.get("style_score", 10) < 6:
            logger.warning("Suggerimento scartato: score basso (%.1f) — %s", suggestion.get("style_score"), suggestion.get("name"))
            continue

        outfit = create_outfit_from_suggestion(suggestion, request.user_id, db)
        db.refresh(outfit)
        outfit = (
            db.query(Outfit)
            .options(joinedload(Outfit.outfit_items).joinedload(OutfitItem.clothing_item))
            .filter(Outfit.id == outfit.id)
            .first()
        )
        saved_outfits.append(OutfitResponse.model_validate(outfit))

    return OutfitGenerateResponse(
        suggestions=[],  # I suggerimenti raw non vengono esposti dopo il salvataggio
        saved_outfits=saved_outfits,
    )


@router.get("", response_model=OutfitListResponse)
def list_outfits(
    user_id: str = Query(...),
    occasion: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Outfit).filter(Outfit.user_id == user_id)

    if occasion:
        query = query.filter(Outfit.occasion.ilike(f"%{occasion}%"))
    if is_favorite is not None:
        query = query.filter(Outfit.is_favorite.is_(is_favorite))

    total = query.count()
    outfits = (
        query.options(joinedload(Outfit.outfit_items).joinedload(OutfitItem.clothing_item))
        .order_by(Outfit.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return OutfitListResponse(
        items=[OutfitResponse.model_validate(o) for o in outfits],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{outfit_id}", response_model=OutfitResponse)
def get_outfit(outfit_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    outfit = _get_outfit_or_404(outfit_id, user_id, db)
    return OutfitResponse.model_validate(outfit)


@router.post("/{outfit_id}/favorite", response_model=OutfitResponse)
def toggle_favorite(outfit_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    outfit = _get_outfit_or_404(outfit_id, user_id, db)
    outfit.is_favorite = not outfit.is_favorite
    db.commit()
    db.refresh(outfit)
    return OutfitResponse.model_validate(outfit)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit(outfit_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    outfit = _get_outfit_or_404(outfit_id, user_id, db)
    db.delete(outfit)
    db.commit()


def _get_outfit_or_404(outfit_id: str, user_id: str, db: Session) -> Outfit:
    outfit = (
        db.query(Outfit)
        .options(joinedload(Outfit.outfit_items).joinedload(OutfitItem.clothing_item))
        .filter(Outfit.id == outfit_id, Outfit.user_id == user_id)
        .first()
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit non trovato")
    return outfit
