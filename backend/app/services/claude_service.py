import json
import logging
from typing import Optional

import anthropic

from app.config import settings
from app.models.clothing import ClothingCategory, ClothingPattern

logger = logging.getLogger(__name__)

# Il modello viene istanziato una volta sola e riusato per tutto il ciclo di vita dell'app
_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


CLOTHING_ANALYSIS_SYSTEM_PROMPT = """Sei un esperto stilista e fashion analyst con occhio clinico per i dettagli.
Analizza immagini di capi di abbigliamento ed estrai metadati precisi e strutturati.

ISTRUZIONI GENERALI:
- Se la foto è parziale, sfocata o con sfondo rumoroso, analizza comunque al meglio del possibile e abbassa il confidence.
- Se un campo non è determinabile con certezza, usa null — non inventare dati.
- Rispondi SEMPRE con JSON valido e NIENT'ALTRO. Zero testo prima o dopo il JSON.

STRUTTURA JSON RICHIESTA:
{
  "category": "<top|bottom|shoes|accessory|dress|outerwear|underwear|bag>",
  "garment_type": "<tipo specifico del capo, esempi: polo, camicia, t-shirt, canotta, felpa con cappuccio, felpa girocollo, maglione, cardigan, giacca, blazer, cappotto, giubbotto, parka, jeans, pantaloni chino, pantaloni formali, shorts, gonna, gonna a tubino, leggings, tuta intera, tuta sportiva, abito casual, abito da sera, sneakers, stivali, scarpe col tacco, mocassini, sandali, borsa a tracolla, zaino, pochette, cintura, sciarpa, cappello, guanti — sii specifico>",
  "color": "<colore primario descrittivo in italiano, es. 'blu navy', 'bianco sporco', 'rosso bordeaux', 'verde militare'>",
  "colors": ["<codice HEX del colore primario, es. #1a3a5c>", "<HEX colore secondario se presente>"],
  "pattern": "<solid|striped|checked|floral|animal_print|geometric|abstract|other>",
  "style_tags": ["<2-5 tag tra: casual, elegante, sportivo, minimalista, bohemian, streetwear, classico, romantico, edgy, preppy, vintage, workwear, athleisure, business-casual>"],
  "season": ["<spring|summer|autumn|winter> — includi tutte le stagioni appropriate per materiale e peso visivo del tessuto"],
  "brand": "<brand se visibile sul capo, altrimenti null>",
  "material": "<materiale stimato visivamente tra: denim, cotone, lana, seta, lino, poliestere, pelle, pelle sintetica, velluto, felpa, neoprene, cachemire, tweed — null se non determinabile>",
  "occasion": ["<2-4 occasioni tra: casual, lavoro, cerimonia, sport, sera, beach, outdoor, loungewear>"],
  "description": "<2-3 frasi descrittive: menziona silhouette, fit, dettagli costruttivi visibili (colletto, bottoni, tasche, zip, cuciture), e come si distingue>",
  "confidence": <float 0.0-1.0 — riduci sotto 0.7 se foto difficile, capo parziale o ambiguo>
}"""


OUTFIT_GENERATION_SYSTEM_PROMPT = """Sei uno stilista personale esperto e onesto che crea outfit coordinati.

REGOLE DI STILE:
- TEORIA DEI COLORI: abbina colori complementari, analoghi o neutri. Evita clash cromatici.
- PROPORZIONI: bilancia silhouette (es. top oversize + bottom slim).
- DRESS CODE: rispetta rigorosamente l'occasione specificata.
- COERENZA STILISTICA: non mescolare stili molto distanti senza intento preciso.
- STAGIONALITÀ: considera materiali e pesi appropriati alla stagione.
- MAX PATTERN: non più di un pattern dominante per outfit.

REGOLE ASSOLUTE — non derogabili:
1. QUALITÀ PRIMA DELLA QUANTITÀ: genera SOLO outfit dove i capi stanno DAVVERO bene insieme (score >= 7). Se una combinazione non funziona, non includerla.
2. NIENTE DUPLICATI: ogni outfit deve usare una combinazione di ID diversa. Se due outfit userebbero gli stessi identici capi, generane solo uno — il migliore.
3. ONESTÀ SUL GUARDAROBA: se il guardaroba è troppo limitato per N outfit distinti e validi, restituisci MENO outfit. È meglio 1 outfit eccellente che 4 identici con nomi diversi.
4. USA SOLO GLI ID FORNITI: non inventare ID o capi che non esistono nel guardaroba.

Rispondi SEMPRE con JSON valido e NIENT'ALTRO."""


def _parse_json_response(text: str) -> dict:
    """Estrae il JSON dalla risposta di Claude, gestendo eventuali markdown code blocks."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Rimuovi prima e ultima riga (``` o ```json)
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)


async def analyze_clothing_item(image_base64: str, filename: str, media_type: str = "image/jpeg") -> dict:
    """
    Analizza un capo di abbigliamento tramite Claude Vision.
    Ritorna un dict strutturato con tutti i metadati estratti.
    """
    client = get_client()

    logger.info("Avvio analisi Claude per: %s", filename)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=CLOTHING_ANALYSIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Analizza questo capo di abbigliamento (file: {filename}). Estrai tutti i metadati richiesti.",
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text
    logger.debug("Risposta Claude analisi: %s", raw_text[:200])

    result = _parse_json_response(raw_text)

    # Validazione e normalizzazione dei campi critici
    valid_categories = {c.value for c in ClothingCategory}
    if result.get("category") not in valid_categories:
        result["category"] = "top"  # fallback sicuro

    valid_patterns = {p.value for p in ClothingPattern}
    if result.get("pattern") not in valid_patterns:
        result["pattern"] = "solid"

    logger.info("Analisi completata per %s: categoria=%s", filename, result.get("category"))
    return result


async def generate_outfit_suggestions(
    clothing_items_metadata: list[dict],
    user_preferences: dict,
    occasion: Optional[str] = None,
    season: Optional[str] = None,
    count: int = 5,
) -> list[dict]:
    """
    Genera suggerimenti di outfit basandosi sui metadati del guardaroba.
    Ritorna una lista di dict, ognuno rappresenta un outfit suggerito.
    """
    client = get_client()

    # Costruiamo un indice compatto per non sprecare token
    wardrobe_summary = []
    for item in clothing_items_metadata:
        wardrobe_summary.append({
            "id": item["id"],
            "name": item["name"],
            "category": item["category"],
            "color": item["color"],
            "colors": item.get("colors", []),
            "pattern": item.get("pattern"),
            "style_tags": item.get("style_tags", []),
            "season": item.get("season", []),
            "occasion": item.get("occasion", []),
            "material": item.get("material"),
        })

    filters = []
    if occasion:
        filters.append(f"Occasione richiesta: {occasion}")
    if season:
        filters.append(f"Stagione: {season}")

    filter_text = "\n".join(filters) if filters else "Nessun filtro specifico."

    n_items = len(clothing_items_metadata)
    prompt = f"""Guardaroba disponibile ({n_items} capi):
{json.dumps(wardrobe_summary, ensure_ascii=False, indent=2)}

Filtri richiesti:
{filter_text}

COMPITO:
Analizza il guardaroba e suggerisci FINO A {count} outfit.
- Genera MENO di {count} outfit se il guardaroba non supporta tante combinazioni distinte e valide.
- Con soli {n_items} capi, le combinazioni possibili sono limitate: non forzare outfit che usano gli stessi identici capi.
- Includi un outfit SOLO se i capi si abbinano realmente bene (score >= 7/10).
- Se nessuna combinazione è valida stilisticamente, restituisci un array vuoto [].

Per ogni outfit usa questo schema JSON:
[
  {{
    "name": "<nome creativo per l'outfit>",
    "clothing_item_ids": ["<id1>", "<id2>"],
    "outfit_items": [
      {{"clothing_item_id": "<id>", "role": "<ruolo: es. base, statement piece, layer>"}}
    ],
    "occasion": "<occasione principale>",
    "season": ["<stagioni appropriate>"],
    "style_score": <float 7.0-10.0>,
    "ai_reasoning": "<spiega in 2-3 frasi perché questi capi stanno bene insieme: colori, proporzioni, stile>",
    "ai_style_notes": {{
      "color_harmony": "<come i colori interagiscono>",
      "key_pieces": ["<capo principale>"],
      "styling_tips": ["<1-2 consigli pratici su come indossarlo>"]
    }}
  }}
]

Rispondi SOLO con il JSON array, nessun testo prima o dopo."""

    logger.info(
        "Generazione %d outfit per occasione=%s stagione=%s", count, occasion, season
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=OUTFIT_GENERATION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = message.content[0].text
    suggestions = _parse_json_response(raw_text)

    if not isinstance(suggestions, list):
        raise ValueError("Claude non ha restituito un array di outfit")

    logger.info("Generati %d suggerimenti outfit", len(suggestions))
    return suggestions


async def get_style_advice(outfit_metadata: dict) -> str:
    """
    Genera consigli di styling narrativi per un outfit specifico.
    Ritorna una stringa di testo con i consigli.
    """
    client = get_client()

    prompt = f"""Fornisci consigli di styling dettagliati per questo outfit:
{json.dumps(outfit_metadata, ensure_ascii=False, indent=2)}

Includi:
- Come indossarlo al meglio
- Accessori consigliati
- Variazioni per diverse occasioni o temperature
- Errori comuni da evitare con questo tipo di combinazione

Rispondi in italiano in modo diretto e pratico, senza JSON."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text
