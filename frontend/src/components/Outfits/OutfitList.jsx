import { Layers } from 'lucide-react'
import OutfitCard from './OutfitCard.jsx'

function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="skeleton h-5 w-24 rounded" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton w-16 h-16 rounded-lg" />
        ))}
      </div>
      <div className="skeleton h-3 w-32 rounded" />
      <div className="skeleton h-8 w-full rounded-lg" />
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-brand-400 mb-4">
        <Layers size={24} />
      </div>
      <p className="text-sm text-brand-500 max-w-xs">{message}</p>
    </div>
  )
}

export default function OutfitList({
  outfits,
  isLoading,
  emptyMessage = 'Nessun outfit trovato.',
  onToggleFavorite,
  onTryOn,
  onDelete,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {outfits.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        outfits.map((outfit) => (
          <OutfitCard
            key={outfit.id}
            outfit={outfit}
            onToggleFavorite={onToggleFavorite}
            onTryOn={onTryOn}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  )
}
