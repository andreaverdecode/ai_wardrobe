import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Pencil, Trash2, Layers, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const CATEGORY_COLORS = {
  top:        'bg-blue-50 text-blue-700',
  bottom:     'bg-emerald-50 text-emerald-700',
  dress:      'bg-purple-50 text-purple-700',
  outerwear:  'bg-amber-50 text-amber-700',
  shoes:      'bg-rose-50 text-rose-700',
  accessory:  'bg-orange-50 text-orange-700',
  default:    'bg-brand-100 text-brand-600',
}

const SEASON_LABELS = {
  spring: 'Primavera',
  summer: 'Estate',
  autumn: 'Autunno',
  winter: 'Inverno',
  all:    'Tutte le stagioni',
}

function ContextMenu({ onEdit, onDelete, onFindOutfit, onReanalyze, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-8 right-0 z-20 min-w-[160px] bg-white rounded-xl shadow-modal border border-brand-100 py-1 overflow-hidden"
    >
      {[
        { icon: Pencil,    label: 'Modifica',       action: onEdit },
        { icon: Layers,    label: 'Trova outfit',   action: onFindOutfit },
        { icon: RefreshCw, label: 'Rianalizza',     action: onReanalyze },
        { icon: Trash2,    label: 'Elimina',        action: onDelete, danger: true },
      ].map(({ icon: Icon, label, action, danger }) => (
        <button
          key={label}
          type="button"
          onClick={() => { action?.(); onClose() }}
          className={clsx(
            'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
            danger
              ? 'text-red-500 hover:bg-red-50'
              : 'text-brand-700 hover:bg-brand-50',
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ClothingCard({
  item,
  onEdit,
  onDelete,
  onFindOutfit,
  onReanalyze,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [imgError, setImgError] = useState(false)

  const categoryClass =
    CATEGORY_COLORS[item.category?.toLowerCase()] ?? CATEGORY_COLORS.default

  const seasonLabel = Array.isArray(item.season)
    ? item.season.map((s) => SEASON_LABELS[s] ?? s).join(', ')
    : (SEASON_LABELS[item.season?.toLowerCase()] ?? item.season)

  return (
    <article className="group relative card overflow-hidden transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
      {/* Image */}
      <div className="relative aspect-[3/4] bg-brand-50 overflow-hidden">
        {!imgError && item.image_path ? (
          <img
            src={`/${item.image_path}`}
            alt={item.name ?? 'Vestito'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-brand-300">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
            </svg>
          </div>
        )}

        {/* Category badge */}
        {item.category && (
          <span className={clsx('badge absolute top-2 left-2 shadow-sm', categoryClass)}>
            {item.category}
          </span>
        )}

        {/* Context menu trigger */}
        <div className="absolute top-2 right-2">
          <button
            type="button"
            aria-label="Opzioni"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm text-brand-600 hover:bg-white hover:text-brand-900 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <ContextMenu
              onEdit={onEdit}
              onDelete={onDelete}
              onFindOutfit={onFindOutfit}
              onReanalyze={onReanalyze}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Name */}
        <p className="text-sm font-medium text-brand-900 truncate leading-snug">
          {item.name ?? 'Vestito senza nome'}
        </p>

        {/* Garment type + Colors */}
        <div className="flex items-center justify-between gap-2">
          {item.garment_type && (
            <p className="text-xs text-brand-500 truncate">{item.garment_type}</p>
          )}
          {item.colors?.length > 0 && (
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {item.colors.slice(0, 4).map((color, i) => (
                <span
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border border-white ring-1 ring-brand-200 shrink-0"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Season */}
        {seasonLabel && (
          <p className="text-xs text-brand-400">{seasonLabel}</p>
        )}
      </div>
    </article>
  )
}
