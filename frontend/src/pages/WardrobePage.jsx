import { useState } from 'react'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useWardrobe } from '../hooks/useWardrobe.js'
import WardrobeGrid from '../components/Wardrobe/WardrobeGrid.jsx'
import UploadModal from '../components/Wardrobe/UploadModal.jsx'
import toast from 'react-hot-toast'

const CATEGORIES = ['', 'top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']
const SEASONS    = ['', 'spring', 'summer', 'autumn', 'winter', 'all']
const SEASON_LABELS = {
  '': 'Stagione',
  spring: 'Primavera',
  summer: 'Estate',
  autumn: 'Autunno',
  winter: 'Inverno',
  all:    'Tuttoann.',
}
const CATEGORY_LABELS = {
  '':          'Categoria',
  top:         'Top',
  bottom:      'Pantaloni',
  dress:       'Abiti',
  outerwear:   'Capispalla',
  shoes:       'Scarpe',
  accessory:   'Accessori',
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-brand-900 text-white border-brand-900'
          : 'bg-white text-brand-600 border-brand-200 hover:border-brand-400',
      )}
    >
      {label}
    </button>
  )
}

export default function WardrobePage() {
  const navigate = useNavigate()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const {
    clothing,
    isLoading,
    isError,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    upload,
    resetUpload,
    isUploading,
    uploadProgress,
    uploadedItem,
    remove,
  } = useWardrobe()

  function handleFindOutfit(item) {
    navigate('/outfit', { state: { preselected: item } })
  }

  function handleEdit(item) {
    toast('Modifica vestito: funzione in arrivo.', { icon: 'i' })
  }

  function handleDelete(id) {
    if (window.confirm('Eliminare questo vestito?')) {
      remove(id)
    }
  }

  function handleReanalyze(id) {
    toast('Rianalisi in corso...')
  }

  const hasFilters = activeFilterCount > 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900 tracking-tight">
            Il mio armadio
          </h1>
          {!isLoading && (
            <p className="text-sm text-brand-400 mt-0.5">
              {clothing.length} {clothing.length === 1 ? 'capo' : 'capi'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="btn-primary self-start sm:self-auto"
        >
          <Plus size={16} />
          Aggiungi vestito
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="Cerca nel guardaroba..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={clsx(
            'btn self-start sm:self-auto',
            filtersOpen || hasFilters
              ? 'bg-brand-900 text-white hover:bg-brand-800'
              : 'btn-secondary',
          )}
        >
          <SlidersHorizontal size={15} />
          Filtri
          {hasFilters && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-brand-900 text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filter panel */}
      {filtersOpen && (
        <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-700">Filtra per</span>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-800"
              >
                <X size={12} /> Rimuovi filtri
              </button>
            )}
          </div>

          {/* Category chips */}
          <div>
            <p className="label mb-2">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <FilterChip
                  key={cat || 'all'}
                  label={CATEGORY_LABELS[cat]}
                  active={filters.category === cat}
                  onClick={() => setFilter('category', cat)}
                />
              ))}
            </div>
          </div>

          {/* Season chips */}
          <div>
            <p className="label mb-2">Stagione</p>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <FilterChip
                  key={s || 'all-s'}
                  label={SEASON_LABELS[s]}
                  active={filters.season === s}
                  onClick={() => setFilter('season', s)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 space-y-1">
          <p className="font-medium">Errore nel caricamento del guardaroba</p>
          <p className="font-mono text-xs break-all">{error?.message}</p>
          {error?.response && (
            <p className="font-mono text-xs">Status: {error.response.status} — {JSON.stringify(error.response.data)}</p>
          )}
        </div>
      )}

      {/* Grid */}
      <WardrobeGrid
        clothing={clothing}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onAddClick={() => setUploadOpen(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onFindOutfit={handleFindOutfit}
        onReanalyze={handleReanalyze}
      />

      {/* Upload modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); resetUpload() }}
        onUpload={upload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadedItem={uploadedItem}
      />
    </div>
  )
}
