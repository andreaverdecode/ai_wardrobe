import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON, Boolean, Text, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class JobType(str, enum.Enum):
    ANALYSIS = "analysis"
    OUTFIT_GENERATION = "outfit_generation"
    MODEL_GENERATION = "model_generation"
    TRYON = "tryon"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class OutfitItem(Base):
    """Junction table tra Outfit e ClothingItem con il ruolo del capo nell'outfit."""

    __tablename__ = "outfit_items"

    outfit_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("outfits.id", ondelete="CASCADE"), primary_key=True
    )
    clothing_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clothing_items.id", ondelete="CASCADE"), primary_key=True
    )
    # Il ruolo contestuale nell'outfit (es. "layering piece", "statement item")
    # può differire dalla categoria del capo
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    outfit: Mapped["Outfit"] = relationship("Outfit", back_populates="outfit_items")
    clothing_item: Mapped["ClothingItem"] = relationship(  # noqa: F821
        "ClothingItem", back_populates="outfit_associations"
    )


class Outfit(Base):
    __tablename__ = "outfits"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Lista degli ID dei capi come JSON array (ridondante con outfit_items ma utile per query rapide)
    clothing_item_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    occasion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    season: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Punteggio 0-10 assegnato da Claude basato su coerenza stilistica
    style_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Spiegazione testuale del perché i capi funzionano insieme
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_style_notes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Path immagine figura umana generata da Stable Diffusion
    base_model_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Path immagine risultante da IDM-VTON
    tryon_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="outfits")  # noqa: F821
    outfit_items: Mapped[list["OutfitItem"]] = relationship(
        "OutfitItem", back_populates="outfit", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Outfit id={self.id} name={self.name}>"


class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    job_type: Mapped[JobType] = mapped_column(SAEnum(JobType), nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus), default=JobStatus.PENDING, nullable=False
    )
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<GenerationJob id={self.id} type={self.job_type} status={self.status}>"
