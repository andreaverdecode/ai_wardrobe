from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.clothing import ClothingCategory, ClothingPattern


class ClothingItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: ClothingCategory
    garment_type: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=100)
    colors: Optional[List[str]] = None
    pattern: Optional[ClothingPattern] = None
    style_tags: Optional[List[str]] = None
    season: Optional[List[str]] = None
    brand: Optional[str] = Field(None, max_length=255)
    material: Optional[str] = Field(None, max_length=255)
    occasion: Optional[List[str]] = None


class ClothingItemCreate(ClothingItemBase):
    user_id: str


class ClothingItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[ClothingCategory] = None
    color: Optional[str] = Field(None, max_length=100)
    colors: Optional[List[str]] = None
    pattern: Optional[ClothingPattern] = None
    style_tags: Optional[List[str]] = None
    season: Optional[List[str]] = None
    brand: Optional[str] = Field(None, max_length=255)
    material: Optional[str] = Field(None, max_length=255)
    occasion: Optional[List[str]] = None


class ClothingItemResponse(ClothingItemBase):
    id: str
    user_id: str
    image_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    ai_description: Optional[str] = None
    ai_metadata: Optional[dict] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClothingItemListResponse(BaseModel):
    items: List[ClothingItemResponse]
    total: int
    page: int
    page_size: int


class ClothingUploadResponse(BaseModel):
    item: ClothingItemResponse
    analysis_performed: bool
    message: str


class ClothingAnalysisResult(BaseModel):
    """Risultato strutturato dell'analisi Claude su un capo."""

    category: ClothingCategory
    color: str
    colors: List[str]
    pattern: ClothingPattern
    style_tags: List[str]
    season: List[str]
    brand: Optional[str] = None
    material: Optional[str] = None
    occasion: List[str]
    description: str
    confidence: float = Field(..., ge=0.0, le=1.0)
