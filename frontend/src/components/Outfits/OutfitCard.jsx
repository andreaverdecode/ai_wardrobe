import { useState } from 'react'
import { Heart, Camera, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react'
import clsx from 'clsx'

const OCCASION_LABELS = {
  casual:   'Casual',
  formal:   'Formale',
  sport:    'Sport',
  evening:  'Sera',
  work:     'Lavoro',
  weekend:  'Weekend',
}

const SEASON_LABELS = {
  spring: 'Primavera',
  summer: 'Estate',
  autumn: 'Autunno',
  winter: 'Inverno',
  all:    'Tuttoann.',
}

function StyleScore({ score }) {
  const clamped = Math.max(0, Math.min(10, score ?? 0))
  const stars   = Math.round(clamped / 2) // 0-5

  return (
    <div className="flex items-center gap-1" aria-label={`Punteggio stile: ${clamped}/10`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < stars ? 'text-amber-400 fill-amber-400' : 'text-brand-200'}
        />
      ))}
      <span className="text-xs text-brand-400 ml-0.5">{clamped}/10</span>
    </div>
  )
}

function ClothingThumb({ item }) {
  const [err, setErr] = useState(false)

  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-brand-100 shrink-0 border border-brand-200">
      {item.image_path && !err ? (
        <img
          src={`/${item.image_path}`}
          alt={item.name ?? ''}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-brand-300 text-xs text-center p-1">
          {item.category ?? '—'}
        </div>
      )}
    </div>
  )
}

export default function OutfitCard({
  outfit,
  onToggleFavorite,
  onTryOn,
  onDelete,
}) {
  const [reasonExpanded, setReasonExpanded] = useState(false)

  const occasionLabel = OCCASION_LABELS[outfit.occasion?.toLowerCase()] ?? outfit.occasion
  const seasonLabel = Array.isArray(outfit.season)
    ? outfit.season.map((s) => SEASON_LABELS[s] ?? s).join(', ')
    : (SEASON_LABELS[outfit.season?.toLowerCase()] ?? outfit.season)

  const reasoning = outfit.reasoning ?? outfit.description
  const hasReasoning = reasoning && reasoning.length > 0

  return (
    <article className="card p-4 space-y-4 hover:shadow-card-hover transition-shadow duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {occasionLabel && (
            <span className="badge bg-brand-100 text-brand-700">{occasionLabel}</span>
          )}
          {seasonLabel && (
            <span className="badge bg-brand-50 text-brand-500">{seasonLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleFavorite?.(outfit.id)}
            aria-label={outfit.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            className={clsx(
              'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
              outfit.is_favorite
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-brand-400 hover:text-red-400 hover:bg-red-50',
            )}
          >
            <Heart size={16} className={outfit.is_favorite ? 'fill-current' : ''} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(outfit.id)}
            aria-label="Elimina outfit"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-brand-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Try-on preview se disponibile, altrimenti thumbnails capi */}
      {outfit.tryon_image_path ? (
        <div className="rounded-xl overflow-hidden bg-brand-50 border border-brand-200 aspect-[3/4] w-32">
          <img
            src={`/${outfit.tryon_image_path}`}
            alt="Try-on"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : outfit.items?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {outfit.items.map((item) => (
            <ClothingThumb key={item.id ?? item.clothing_id} item={item} />
          ))}
        </div>
      )}

      {/* Style score */}
      {outfit.style_score != null && (
        <StyleScore score={outfit.style_score} />
      )}

      {/* Reasoning */}
      {hasReasoning && (
        <div>
          <button
            type="button"
            onClick={() => setReasonExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-800 transition-colors"
          >
            {reasonExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {reasonExpanded ? 'Nascondi ragionamento' : 'Vedi ragionamento AI'}
          </button>
          {reasonExpanded && (
            <p className="mt-2 text-xs text-brand-600 leading-relaxed bg-brand-50 rounded-lg px-3 py-2.5">
              {reasoning}
            </p>
          )}
        </div>
      )}

      {/* Try-on CTA */}
      <button
        type="button"
        onClick={() => onTryOn?.(outfit)}
        className="btn-secondary w-full text-xs"
      >
        <Camera size={14} />
        Prova questo outfit
      </button>
    </article>
  )
}
