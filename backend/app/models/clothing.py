import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class ClothingCategory(str, enum.Enum):
    TOP = "top"
    BOTTOM = "bottom"
    SHOES = "shoes"
    ACCESSORY = "accessory"
    DRESS = "dress"
    OUTERWEAR = "outerwear"
    UNDERWEAR = "underwear"
    BAG = "bag"


class ClothingPattern(str, enum.Enum):
    SOLID = "solid"
    STRIPED = "striped"
    CHECKED = "checked"
    FLORAL = "floral"
    ANIMAL_PRINT = "animal_print"
    GEOMETRIC = "geometric"
    ABSTRACT = "abstract"
    OTHER = "other"


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[ClothingCategory] = mapped_column(
        SAEnum(ClothingCategory), nullable=False
    )
    # Colore primario come stringa descrittiva (es. "navy blue", "off-white")
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Array di tutti i colori presenti nel capo
    colors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    pattern: Mapped[ClothingPattern | None] = mapped_column(
        SAEnum(ClothingPattern), nullable=True
    )
    style_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    season: Mapped[list | None] = mapped_column(JSON, nullable=True)
    garment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    material: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occasion: Mapped[list | None] = mapped_column(JSON, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Testo narrativo generato da Claude per descrivere il capo
    ai_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON completo con tutti i metadati estratti da Claude
    ai_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="clothing_items")  # noqa: F821
    outfit_associations: Mapped[list["OutfitItem"]] = relationship(  # noqa: F821
        "OutfitItem", back_populates="clothing_item", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ClothingItem id={self.id} name={self.name} category={self.category}>"
