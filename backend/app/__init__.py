"""
Progetto Armadio — backend package.

Struttura:
  models/   — ORM SQLAlchemy (source of truth per lo schema DB)
  schemas/  — Pydantic models (validazione I/O API)
  routers/  — FastAPI route handlers
  services/ — Business logic e chiamate a servizi esterni (Claude, Replicate)
  utils/    — Utilities condivise (file handling, ecc.)
"""
