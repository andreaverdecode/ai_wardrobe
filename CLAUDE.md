# CLAUDE.md — Progetto Armadio

Guida per Claude Code su questo progetto.

## Architettura

**Frontend:** React 18 + Vite + Tailwind CSS in `frontend/`
**Backend:** Python 3.11 + FastAPI + SQLAlchemy in `backend/`
**DB attuale:** SQLite (`backend/armadio.db`) — migrazione pianificata a PostgreSQL

Dipendenze frontend rilevanti: `react-router-dom`, `@tanstack/react-query`, `axios`, `react-dropzone`, `react-hot-toast`, `lucide-react`.

Dipendenze backend rilevanti: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pydantic`, `anthropic`, `replicate`, `pillow`, `python-jose`, `passlib`.

## Comandi utili

### Backend
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000   # avvia dev server
pytest                                   # esegui test
alembic revision --autogenerate -m "msg" # genera migrazione
alembic upgrade head                     # applica migrazioni
```

### Frontend
```bash
cd frontend
npm run dev      # avvia dev server su :5173
npm run build    # build produzione
npm run lint     # lint ESLint
```

## Modelli AI utilizzati

| Modello | Uso | SDK |
|---------|-----|-----|
| `claude-sonnet-4-6` | Analisi vestiti + suggerimenti outfit | `anthropic` Python SDK |
| `stability-ai/sdxl` | Generazione figura umana base | `replicate` Python SDK |
| `yisol/idm-vton` | Virtual try-on | `replicate` Python SDK |

**Importante:** Non cambiare `claude-sonnet-4-6` con altri modelli senza aggiornare i system prompt — sono ottimizzati per questo modello.

## Schema DB

Le tabelle principali sono in `backend/app/models/`. La struttura è progettata per PostgreSQL — usare `Column(JSON)` per i campi array/oggetto, non soluzioni SQLite-specifiche.

### Tabelle
- `users` — profilo utente e preferenze stile
- `clothing_items` — capi dell'armadio con metadati AI
- `outfits` — outfit generati con immagini try-on
- `outfit_items` — junction table outfit↔capi
- `generation_jobs` — tracking job asincroni Replicate

## Dove sta la logica AI

- `backend/app/services/claude_service.py` — tutto ciò che riguarda Claude
- `backend/app/services/replicate_service.py` — chiamate Stable Diffusion e IDM-VTON
- `backend/app/services/outfit_service.py` — orchestrazione logica outfit

## Convenzioni di codice

- **Nessun commento** su cosa fa il codice — solo il perché se non è ovvio
- **Type hints** su tutti i metodi Python
- **Pydantic schemas** per tutto ciò che entra/esce dalle API, mai passare modelli ORM direttamente
- **Response models** espliciti su ogni endpoint FastAPI
- File uploads salvati in `backend/uploads/` con nome UUID — mai usare il filename originale

## Gestione errori

- I servizi AI (`claude_service`, `replicate_service`) non sollevano eccezioni verso i router — restituiscono `None` o dict vuoto in caso di errore e loggano il problema
- I router usano `HTTPException` per tutti gli errori HTTP
- Errori 422 (validazione Pydantic) sono automatici — non duplicare la validazione

## Migrazione PostgreSQL (futuro)

Quando si migrerà:
1. Aggiornare `DATABASE_URL` in `.env`
2. In `database.py`: rimuovere `connect_args` e `PRAGMA foreign_keys` (già marcati con commento `# SQLite-only`)
3. I filtri `.contains()` su colonne JSON vanno sostituiti con operatori `@>` di PostgreSQL
4. Usare `alembic` per le migrazioni — non `Base.metadata.create_all()`

## Variabili d'ambiente richieste

Vedi `.env.example`. Quelle obbligatorie in sviluppo:
- `ANTHROPIC_API_KEY`
- `REPLICATE_API_TOKEN`
