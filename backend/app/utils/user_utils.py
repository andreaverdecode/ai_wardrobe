from sqlalchemy.orm import Session
from app.models.user import User


def get_or_create_user(user_id: str, db: Session) -> str:
    """Restituisce l'utente esistente o ne crea uno placeholder per sviluppo senza auth."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=f"{user_id}@local.dev",
            name="Utente",
        )
        db.add(user)
        db.commit()
    return user_id
