import { Plus, ShoppingBag } from 'lucide-react'
import ClothingCard from './ClothingCard.jsx'

// ─── Skeleton card ────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[3/4] w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────
function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 text-brand-400 mb-4">
        <ShoppingBag size={28} />
      </div>
      {hasFilters ? (
        <>
          <h3 className="text-base font-medium text-brand-700 mb-1">
            Nessun risultato
          </h3>
          <p className="text-sm text-brand-400 max-w-xs">
            Nessun vestito corrisponde ai filtri selezionati. Prova a modificare la ricerca.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-medium text-brand-700 mb-1">
            Il tuo armadio e' vuoto
          </h3>
          <p className="text-sm text-brand-400 max-w-xs mb-6">
            Aggiungi il tuo primo vestito e lascia che l'AI lo analizzi per te.
          </p>
          <button type="button" onClick={onAdd} className="btn-primary">
            <Plus size={16} />
            Aggiungi vestito
          </button>
        </>
      )}
    </div>
  )
}

// ─── Grid ─────────────────────────────────────────────────────────
export default function WardrobeGrid({
  clothing,
  isLoading,
  hasFilters,
  onAddClick,
  onEdit,
  onDelete,
  onFindOutfit,
  onReanalyze,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {clothing.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onAdd={onAddClick} />
      ) : (
        clothing.map((item) => (
          <ClothingCard
            key={item.id}
            item={item}
            onEdit={() => onEdit?.(item)}
            onDelete={() => onDelete?.(item.id)}
            onFindOutfit={() => onFindOutfit?.(item)}
            onReanalyze={() => onReanalyze?.(item.id)}
          />
        ))
      )}
    </div>
  )
}
