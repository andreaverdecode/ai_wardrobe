from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator
from app.models.outfit import JobType, JobStatus


class ClothingItemBrief(BaseModel):
    id: str
    name: Optional[str] = None
    category: Optional[str] = None
    garment_type: Optional[str] = None
    image_path: Optional[str] = None
    color: Optional[str] = None
    ai_description: Optional[str] = None
    model_config = {"from_attributes": True}


class OutfitItemDetail(BaseModel):
    clothing_item_id: str
    role: Optional[str] = None
    clothing_item: Optional[ClothingItemBrief] = None
    model_config = {"from_attributes": True}


class OutfitBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    occasion: Optional[str] = Field(None, max_length=255)
    season: Optional[List[str]] = None


class OutfitGenerateRequest(BaseModel):
    user_id: str
    occasion: Optional[str] = None
    season: Optional[str] = None
    count: int = Field(default=5, ge=1, le=10)
    clothing_item_ids: Optional[List[str]] = None


class OutfitResponse(OutfitBase):
    id: str
    user_id: str
    clothing_item_ids: Optional[List[str]] = None
    outfit_items: List[OutfitItemDetail] = []
    items: List[ClothingItemBrief] = []
    style_score: Optional[float] = None
    ai_reasoning: Optional[str] = None
    ai_style_notes: Optional[dict] = None
    base_model_image_path: Optional[str] = None
    tryon_image_path: Optional[str] = None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode='after')
    def populate_items(self) -> 'OutfitResponse':
        if not self.items:
            self.items = [
                oi.clothing_item for oi in self.outfit_items
                if oi.clothing_item is not None
            ]
        return self


class OutfitListResponse(BaseModel):
    items: List[OutfitResponse]
    total: int
    page: int
    page_size: int


class OutfitSuggestion(BaseModel):
    """Singolo suggerimento outfit prodotto da Claude prima del salvataggio."""

    name: str
    clothing_item_ids: List[str]
    outfit_items: List[OutfitItemDetail]
    occasion: Optional[str] = None
    season: Optional[List[str]] = None
    style_score: float = Field(..., ge=0.0, le=10.0)
    ai_reasoning: str
    ai_style_notes: Optional[dict] = None


class OutfitGenerateResponse(BaseModel):
    suggestions: List[OutfitSuggestion]
    saved_outfits: List[OutfitResponse]


class GenerationJobResponse(BaseModel):
    id: str
    job_type: JobType
    status: JobStatus
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GarmentItem(BaseModel):
    image_path: str
    description: str
    category: str = "top"


class TryonApplyRequest(BaseModel):
    model_image_url: str
    garment_items: list[GarmentItem]
    outfit_id: Optional[str] = None


class TryonGenerateModelRequest(BaseModel):
    prompt: Optional[str] = None
    gender: str = Field(default="female", pattern="^(female|male|neutral)$")
    style: str = Field(default="fashion editorial")
