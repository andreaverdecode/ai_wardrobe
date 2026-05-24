import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.clothing import ClothingItem
from app.models.outfit import Outfit, OutfitItem
from app.schemas.outfit import OutfitSuggestion

logger = logging.getLogger(__name__)


def create_outfit_from_suggestion(
    suggestion: dict,
    user_id: str,
    db: Session,
) -> Outfit:
    """
    Orchestratore: prende un singolo suggerimento Claude e persiste l'outfit nel DB.
    Il suggerimento deve avere la struttura prodotta da claude_service.generate_outfit_suggestions.
    """
    outfit = Outfit(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=suggestion["name"],
        clothing_item_ids=suggestion.get("clothing_item_ids", []),
        occasion=suggestion.get("occasion"),
        season=suggestion.get("season"),
        style_score=suggestion.get("style_score"),
        ai_reasoning=suggestion.get("ai_reasoning"),
        ai_style_notes=suggestion.get("ai_style_notes"),
    )
    db.add(outfit)
    db.flush()  # genera l'id senza commit per poter creare gli OutfitItem

    for item_data in suggestion.get("outfit_items", []):
        outfit_item = OutfitItem(
            outfit_id=outfit.id,
            clothing_item_id=item_data["clothing_item_id"],
            role=item_data.get("role"),
        )
        db.add(outfit_item)

    db.commit()
    db.refresh(outfit)
    logger.info("Outfit creato: id=%s name=%s", outfit.id, outfit.name)
    return outfit


def get_compatible_items(
    item_id: str,
    user_id: str,
    db: Session,
    limit: int = 20,
) -> list[ClothingItem]:
    """
    Trova capi compatibili con un capo specifico basandosi su regole euristiche:
    - Complementarietà di categoria (es. top → bottom, scarpe)
    - Sovrapposizione di stagioni
    - Compatibilità di stile (style_tags in comune)

    Questo metodo serve come pre-filtro prima di passare i dati a Claude
    per la generazione outfit.
    """
    source_item = (
        db.query(ClothingItem)
        .filter(
            ClothingItem.id == item_id,
            ClothingItem.user_id == user_id,
            ClothingItem.is_active.is_(True),
        )
        .first()
    )

    if not source_item:
        return []

    # Categorie che si abbinano bene con ogni categoria sorgente
    COMPATIBLE_CATEGORIES = {
        "top": ["bottom", "shoes", "accessory", "outerwear", "bag"],
        "bottom": ["top", "shoes", "accessory", "outerwear", "bag"],
        "dress": ["shoes", "accessory", "outerwear", "bag"],
        "outerwear": ["top", "bottom", "dress", "shoes", "bag"],
        "shoes": ["top", "bottom", "dress", "outerwear"],
        "accessory": ["top", "bottom", "dress", "outerwear"],
        "bag": ["top", "bottom", "dress", "outerwear", "shoes"],
        "underwear": [],
    }

    compatible_categories = COMPATIBLE_CATEGORIES.get(source_item.category.value, [])

    if not compatible_categories:
        return []

    # Query base: stesso utente, attivi, categoria compatibile, non sé stesso
    candidates = (
        db.query(ClothingItem)
        .filter(
            ClothingItem.user_id == user_id,
            ClothingItem.is_active.is_(True),
            ClothingItem.id != item_id,
            ClothingItem.category.in_(compatible_categories),
        )
        .all()
    )

    # Scoring euristico per ordinare i risultati (stagioni in comune, stile in comune)
    source_seasons = set(source_item.season or [])
    source_tags = set(source_item.style_tags or [])

    def score(candidate: ClothingItem) -> int:
        candidate_seasons = set(candidate.season or [])
        candidate_tags = set(candidate.style_tags or [])
        season_overlap = len(source_seasons & candidate_seasons)
        tag_overlap = len(source_tags & candidate_tags)
        return season_overlap * 2 + tag_overlap

    candidates.sort(key=score, reverse=True)
    return candidates[:limit]
