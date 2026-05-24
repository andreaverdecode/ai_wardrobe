import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Preferenze stilistiche: colori preferiti, stili, occasioni tipiche, ecc.
    style_preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    clothing_items: Mapped[list["ClothingItem"]] = relationship(  # noqa: F821
        "ClothingItem", back_populates="user", cascade="all, delete-orphan"
    )
    outfits: Mapped[list["Outfit"]] = relationship(  # noqa: F821
        "Outfit", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
