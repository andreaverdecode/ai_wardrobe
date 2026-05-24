import { useState } from 'react'
import { Sparkles, Heart, Loader2, ChevronDown } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useOutfits } from '../hooks/useOutfits.js'
import OutfitList from '../components/Outfits/OutfitList.jsx'
import toast from 'react-hot-toast'

const OCCASIONS = [
  { value: '',         label: 'Qualsiasi' },
  { value: 'casual',   label: 'Casual'    },
  { value: 'formal',   label: 'Formale'   },
  { value: 'sport',    label: 'Sport'     },
  { value: 'evening',  label: 'Sera'      },
  { value: 'work',     label: 'Lavoro'    },
  { value: 'weekend',  label: 'Weekend'   },
]

const SEASONS = [
  { value: '',         label: 'Qualsiasi' },
  { value: 'spring',   label: 'Primavera' },
  { value: 'summer',   label: 'Estate'    },
  { value: 'autumn',   label: 'Autunno'   },
  { value: 'winter',   label: 'Inverno'   },
]

const COUNT_OPTIONS = [2, 4, 6, 8]

function Select({ id, label, value, onChange, options }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input appearance-none pr-8"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
        />
      </div>
    </div>
  )
}

export default function OutfitsPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'favorites'

  const {
    outfits,
    favorites,
    isLoading,
    isError,
    generateParams,
    setParam,
    generate,
    isGenerating,
    toggleFavorite,
    remove,
  } = useOutfits()

  function handleGenerate() {
    generate(generateParams)
  }

  function handleTryOn(outfit) {
    navigate('/tryon', { state: { outfit } })
  }

  const displayedOutfits = activeTab === 'favorites' ? favorites : outfits

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-brand-900 tracking-tight">Outfit</h1>
        <p className="text-sm text-brand-400 mt-0.5">
          Lascia che l'AI crei combinazioni perfette dal tuo guardaroba
        </p>
      </div>

      {/* Generate form */}
      <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-5">
        <h2 className="text-base font-semibold text-brand-900">Genera nuovi outfit</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            id="occasion"
            label="Occasione"
            value={generateParams.occasion}
            onChange={(v) => setParam('occasion', v)}
            options={OCCASIONS}
          />
          <Select
            id="season"
            label="Stagione"
            value={generateParams.season}
            onChange={(v) => setParam('season', v)}
            options={SEASONS}
          />
          <div>
            <label className="label">Numero suggerimenti</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParam('count', n)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                    generateParams.count === n
                      ? 'bg-brand-900 text-white border-brand-900'
                      : 'border-brand-200 text-brand-600 hover:border-brand-400',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn-primary w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generazione in corso...
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Genera outfit
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-center gap-1 mb-5 border-b border-brand-200">
          {[
            { key: 'all',       label: `Tutti gli outfit (${outfits.length})` },
            { key: 'favorites', label: `Preferiti (${favorites.length})`, icon: Heart },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === key
                  ? 'border-brand-900 text-brand-900'
                  : 'border-transparent text-brand-500 hover:text-brand-800',
              )}
            >
              {Icon && <Icon size={14} className={activeTab === key && key === 'favorites' ? 'text-red-400 fill-red-400' : ''} />}
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">
            Impossibile caricare gli outfit. Riprova.
          </div>
        )}

        <OutfitList
          outfits={displayedOutfits}
          isLoading={isLoading}
          emptyMessage={
            activeTab === 'favorites'
              ? 'Nessun outfit nei preferiti. Salva quelli che ti piacciono di piu\'.'
              : 'Nessun outfit ancora. Generane qualcuno con il modulo sopra.'
          }
          onToggleFavorite={toggleFavorite}
          onTryOn={handleTryOn}
          onDelete={remove}
        />
      </div>
    </div>
  )
}
