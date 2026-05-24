# Progetto Armadio

Web app per gestire il proprio guardaroba e generare outfit con intelligenza artificiale.

## Funzionalità

- **Caricamento vestiti** — upload foto con analisi automatica via Claude Vision: colori, categoria, stile, stagione
- **Suggerimenti outfit** — Claude analizza il guardaroba e propone combinazioni coerenti con spiegazione del ragionamento
- **Virtual Try-On** — genera una figura umana con Stable Diffusion XL e applica il vestito reale con IDM-VTON

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python 3.11+ + FastAPI + SQLAlchemy |
| Database | SQLite (dev) → PostgreSQL (prod) |
| AI Styling | Claude Sonnet 4.6 (Anthropic SDK) |
| Image Gen | Stable Diffusion XL (Replicate) |
| Virtual Try-On | IDM-VTON `yisol/idm-vton` (Replicate) |

## Prerequisiti

- Python 3.11+
- Node.js 20+
- API key Anthropic
- API token Replicate

## Setup

### 1. Variabili d'ambiente

```bash
cp .env.example .env
# Inserire ANTHROPIC_API_KEY e REPLICATE_API_TOKEN
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend: `http://localhost:8000` — Swagger UI: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Struttura del progetto

```
progetto_armadio/
├── .env.example
├── CLAUDE.md                  # Guida per Claude Code
├── frontend/
│   └── src/
│       ├── api/               # Client HTTP (axios)
│       ├── components/        # Componenti UI riusabili
│       ├── hooks/             # Custom React hooks
│       ├── pages/             # Pagine dell'applicazione
│       └── utils/
└── backend/
    ├── main.py
    ├── requirements.txt
    └── app/
        ├── models/            # Modelli SQLAlchemy
        ├── schemas/           # Schemi Pydantic
        ├── routers/           # Endpoint FastAPI
        ├── services/          # Logica AI e business
        │   ├── claude_service.py
        │   ├── replicate_service.py
        │   └── outfit_service.py
        └── utils/
```

## API principali

Documentazione completa su `/docs` (Swagger UI).

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `POST` | `/api/v1/clothing/upload` | Carica vestito + analisi Claude |
| `GET` | `/api/v1/clothing/` | Lista vestiti con filtri |
| `POST` | `/api/v1/outfits/generate` | Genera suggerimenti outfit |
| `POST` | `/api/v1/tryon/generate-model` | Genera figura umana base |
| `POST` | `/api/v1/tryon/apply` | Applica vestito su figura |

## Variabili d'ambiente

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Sì | Chiave API Anthropic |
| `REPLICATE_API_TOKEN` | Sì | Token API Replicate |
| `SECRET_KEY` | Sì | Chiave per JWT (cambiare in prod) |
| `DATABASE_URL` | No | Default: `sqlite:///./armadio.db` |
| `UPLOAD_DIR` | No | Default: `uploads` |
| `MAX_FILE_SIZE_MB` | No | Default: `10` |

## Migrazione a PostgreSQL

Il progetto è già predisposto. Per passare:

1. Installa `psycopg2-binary`
2. Aggiorna `DATABASE_URL` in `.env`: `postgresql://user:password@host:5432/armadio_db`
3. Rimuovi la logica SQLite-specifica da `app/database.py` (già isolata con commenti `# SQLite-only`)
4. Esegui `alembic upgrade head`

## Licenza

Progetto privato.
