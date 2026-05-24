import { useState } from 'react'
import {
  Plus, Heart, Trash2, Camera, Star, Loader2,
  ChevronDown, Sparkles, Clock, X,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useOutfits, OUTFITS_KEY } from '../hooks/useOutfits.js'
import { useScrollLock } from '../hooks/useScrollLock.js'
import {
  generateOutfits,
  generateModel,
  applyTryOn,
  pollJobUntilDone,
} from '../api/client.js'

// ─── Constants ────────────────────────────────────────────────────

const OCCASIONS = [
  { value: '',        label: 'Qualsiasi'  },
  { value: 'casual',  label: 'Casual'     },
  { value: 'formal',  label: 'Formale'    },
  { value: 'sport',   label: 'Sport'      },
  { value: 'evening', label: 'Sera'       },
  { value: 'work',    label: 'Lavoro'     },
  { value: 'weekend', label: 'Weekend'    },
]

const SEASONS = [
  { value: '',        label: 'Qualsiasi'  },
  { value: 'spring',  label: 'Primavera'  },
  { value: 'summer',  label: 'Estate'     },
  { value: 'autumn',  label: 'Autunno'    },
  { value: 'winter',  label: 'Inverno'    },
]

const GENDERS = [
  { value: 'female', label: 'Donna' },
  { value: 'male',   label: 'Uomo'  },
]

const PHOTO_STYLES = [
  { value: 'fashion editorial', label: 'Studio'  },
  { value: 'outdoor lifestyle', label: 'Outdoor' },
  { value: 'street style',      label: 'Street'  },
]

const COUNT_OPTIONS = [2, 4, 6, 8]

const CHAIN_ORDER = ['bottom', 'top', 'outerwear']

function buildGarmentChain(outfit) {
  if (!outfit?.items?.length) return []
  const dress = outfit.items.find((i) => i.category === 'dress')
  if (dress) return [dress]
  return CHAIN_ORDER
    .map((cat) => outfit.items.find((i) => i.category === cat))
    .filter(Boolean)
    .slice(0, 3)
}

function pickMainItem(outfit) {
  const priority = ['dress', 'outerwear', 'top', 'bottom', 'shoes', 'accessory', 'bag']
  if (!outfit?.items?.length) return null
  for (const cat of priority) {
    const found = outfit.items.find((i) => i.category === cat)
    if (found) return found
  }
  return outfit.items[0]
}

// ─── Feed card (outfit con immagine try-on) ───────────────────────

function FeedCard({ outfit, onFavorite, onDelete }) {
  const imageUrl = outfit.tryon_image_path
    ? `/${outfit.tryon_image_path}`
    : null

  return (
    <div className="relative rounded-2xl overflow-hidden bg-brand-100 shadow-sm">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={outfit.name}
          className="w-full object-cover aspect-[3/4]"
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-brand-100" />
      )}

      {/* Action buttons — min 44×44 px per touch target */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onFavorite(outfit.id)}
          className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-colors active:scale-95"
          aria-label={outfit.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          <Heart
            size={17}
            className={outfit.is_favorite ? 'text-red-400 fill-red-400' : 'text-white'}
          />
        </button>
        <button
          type="button"
          onClick={() => onDelete(outfit.id)}
          className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-colors active:scale-95"
          aria-label="Elimina outfit"
        >
          <Trash2 size={16} className="text-white" />
        </button>
      </div>

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pt-10 pb-4">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold leading-snug truncate">{outfit.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {outfit.occasion && (
                <span className="text-white/80 text-xs bg-white/20 rounded-full px-2 py-0.5">
                  {outfit.occasion}
                </span>
              )}
              {outfit.season && (
                <span className="text-white/80 text-xs bg-white/20 rounded-full px-2 py-0.5">
                  {outfit.season}
                </span>
              )}
            </div>
          </div>
          {outfit.style_score != null && (
            <span className="shrink-0 flex items-center gap-0.5 text-amber-400 text-xs font-semibold">
              <Star size={12} className="fill-amber-400" />
              {outfit.style_score}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pending card (outfit senza immagine try-on) ──────────────────

function PendingCard({ outfit, onFavorite, onDelete, onGenerateTryOn }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-900 truncate">{outfit.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {outfit.occasion && (
              <span className="badge bg-brand-100 text-brand-600">{outfit.occasion}</span>
            )}
            {outfit.season && (
              <span className="badge bg-brand-100 text-brand-600">{outfit.season}</span>
            )}
            {outfit.style_score != null && (
              <span className="flex items-center gap-0.5 text-amber-500 text-xs font-medium">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {outfit.style_score}
              </span>
            )}
          </div>
        </div>
        {/* Touch targets: 44×44 px */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onFavorite(outfit.id)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-brand-50 active:scale-95 transition-transform"
            aria-label={outfit.is_favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          >
            <Heart
              size={16}
              className={outfit.is_favorite ? 'text-red-400 fill-red-400' : 'text-brand-400'}
            />
          </button>
          <button
            type="button"
            onClick={() => onDelete(outfit.id)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-brand-50 active:scale-95 transition-transform"
            aria-label="Elimina outfit"
          >
            <Trash2 size={15} className="text-brand-400" />
          </button>
        </div>
      </div>

      {/* Clothing thumbnails */}
      {outfit.items?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {outfit.items.slice(0, 4).map((item) => (
            <div
              key={item.id ?? item.clothing_id}
              className="w-14 h-14 rounded-xl overflow-hidden bg-brand-100 border border-brand-200 shrink-0"
            >
              {item.image_path ? (
                <img
                  src={`/${item.image_path}`}
                  alt={item.name ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-brand-300 text-xs font-medium">
                  {item.category?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onGenerateTryOn(outfit)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-900 text-white text-sm font-medium hover:bg-brand-800 active:scale-[0.98] transition-transform"
      >
        <Camera size={15} />
        Genera try-on
      </button>
    </div>
  )
}

// ─── Generate outfit modal ────────────────────────────────────────

function GenerateOutfitModal({ open, onClose, onSuccess }) {
  const qc = useQueryClient()
  const [params, setParams] = useState({ occasion: '', season: '', count: 4 })
  useScrollLock(open)

  const mutation = useMutation({
    mutationFn: () => generateOutfits(params),
    onSuccess: () => {
      toast.success('Outfit generati con successo!')
      qc.invalidateQueries({ queryKey: [OUTFITS_KEY] })
      onSuccess()
      onClose()
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet/modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-brand-900">Genera nuovi outfit</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-100 active:scale-95 transition-transform"
            >
              <X size={16} className="text-brand-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Occasione</label>
              <div className="relative">
                <select
                  value={params.occasion}
                  onChange={(e) => setParams((p) => ({ ...p, occasion: e.target.value }))}
                  className="input appearance-none pr-8"
                >
                  {OCCASIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Stagione</label>
              <div className="relative">
                <select
                  value={params.season}
                  onChange={(e) => setParams((p) => ({ ...p, season: e.target.value }))}
                  className="input appearance-none pr-8"
                >
                  {SEASONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="label">Numero suggerimenti</label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParams((p) => ({ ...p, count: n }))}
                    className={clsx(
                      'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      params.count === n
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-primary w-full"
          >
            {mutation.isPending ? (
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

        {/* iOS safe-area spacer (home indicator on notched phones) */}
        <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

// ─── Try-on modal ─────────────────────────────────────────────────

function TryOnModal({ outfit, open, onClose }) {
  const qc = useQueryClient()
  const [options, setOptions] = useState({ gender: 'female', style: 'fashion editorial' })
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  useScrollLock(open)

  async function handleGenerate() {
    const mainItem = pickMainItem(outfit)
    if (!mainItem?.image_path) {
      toast.error("Almeno un capo dell'outfit deve avere un'immagine.")
      return
    }

    setLoading(true)
    try {
      setLoadingMsg('Avvio generazione modello base...')
      const modelJobPending = await generateModel(options)

      setLoadingMsg('Generazione modello AI... (~1 min)')
      const modelJob = await pollJobUntilDone(modelJobPending.id)
      if (modelJob.status === 'failed') throw new Error(modelJob.error_message ?? 'Generazione modello fallita')

      const modelImageUrl = modelJob.output_data?.image_url
      if (!modelImageUrl) throw new Error('URL immagine modello non disponibile')

      const chain = buildGarmentChain(outfit)
      if (!chain.length) throw new Error('Nessun capo valido per il try-on.')

      const garmentItems = chain.map((item) => ({
        image_path:  item.image_path,
        description: item.garment_type ?? item.ai_description ?? item.name ?? item.category ?? '',
        category:    item.category ?? 'top',
      }))

      const estMin = chain.length * 2
      setLoadingMsg(`Try-on in corso (${chain.length} capo${chain.length > 1 ? 'i' : ''})... (~${estMin}-${estMin + chain.length} min)`)
      const tryonJobPending = await applyTryOn({
        model_image_url: modelImageUrl,
        garment_items:   garmentItems,
        outfit_id:       outfit.id,
      })

      const result = await pollJobUntilDone(tryonJobPending.id)
      if (result.status === 'failed') throw new Error(result.error_message ?? 'Try-on fallito')

      toast.success('Try-on completato!')
      qc.invalidateQueries({ queryKey: [OUTFITS_KEY] })
      onClose()
    } catch (err) {
      toast.error(err.message ?? 'Errore durante il try-on. Riprova.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  if (!open || !outfit) return null

  const chain = buildGarmentChain(outfit)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop — non chiudibile durante loading */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Sheet/modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-modal max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          {!loading && (
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-900">Genera try-on</h2>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-100 active:scale-95 transition-transform"
              >
                <X size={16} className="text-brand-500" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
                <div className="absolute inset-0 rounded-full border-4 border-brand-900 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-brand-600 text-center max-w-xs leading-relaxed">{loadingMsg}</p>
            </div>
          ) : (
            <>
              {/* Outfit recap */}
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 space-y-2">
                <p className="text-xs font-medium text-brand-500">Outfit</p>
                <p className="text-sm font-semibold text-brand-900">{outfit.name}</p>
                {chain.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {chain.map((item) => (
                      <div key={item.id ?? item.clothing_id} className="w-10 h-10 rounded-lg overflow-hidden bg-brand-100 border border-brand-200 shrink-0">
                        {item.image_path ? (
                          <img src={`/${item.image_path}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-300 text-xs">{item.category?.[0]?.toUpperCase()}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Genere */}
              <div>
                <label className="label">Genere modello</label>
                <div className="flex gap-3">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setOptions((o) => ({ ...o, gender: g.value }))}
                      className={clsx(
                        'flex-1 py-3 rounded-xl border text-sm font-medium transition-colors',
                        options.gender === g.value
                          ? 'border-brand-900 bg-brand-900 text-white'
                          : 'border-brand-200 text-brand-700 hover:border-brand-400',
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stile foto */}
              <div>
                <label className="label">Stile foto</label>
                <div className="flex gap-2">
                  {PHOTO_STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setOptions((o) => ({ ...o, style: s.value }))}
                      className={clsx(
                        'flex-1 py-3 rounded-xl border text-sm font-medium transition-colors',
                        options.style === s.value
                          ? 'border-brand-900 bg-brand-900 text-white'
                          : 'border-brand-200 text-brand-700 hover:border-brand-400',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                className="btn-primary w-full"
              >
                <Camera size={15} />
                Genera
              </button>
            </>
          )}
        </div>

        {/* iOS safe-area spacer */}
        <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function TryOnPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [tryOnTarget, setTryOnTarget] = useState(null)

  const { outfits, isLoading, toggleFavorite, remove } = useOutfits()

  const feedOutfits     = outfits.filter((o) => o.tryon_image_path)
  const pendingOutfits  = outfits.filter((o) => !o.tryon_image_path)
  const favoriteOutfits = outfits.filter((o) => o.is_favorite && o.tryon_image_path)

  const tabOutfits = activeTab === 'all'
    ? feedOutfits
    : activeTab === 'pending'
      ? pendingOutfits
      : favoriteOutfits

  const tabs = [
    { key: 'all',      label: 'Tutti',     count: feedOutfits.length    },
    { key: 'pending',  label: 'In attesa', count: pendingOutfits.length },
    { key: 'favorites', label: 'Preferiti', count: favoriteOutfits.length },
  ]

  const emptyMessages = {
    all:       'Nessun look con immagine. Vai su "In attesa" per generare i try-on.',
    pending:   'Nessun outfit in attesa. Usa "+ Genera outfit" per crearne di nuovi.',
    favorites: 'Nessun look preferito. Tocca il cuore sui look che ti piacciono.',
  }

  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-brand-900 tracking-tight">Try-On</h1>
            <p className="text-sm text-brand-400 mt-0.5">Scorri i look generati dall'AI</p>
          </div>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary shrink-0"
          >
            <Plus size={15} />
            <span className="hidden xs:inline">Genera outfit</span>
            <span className="xs:hidden">Genera</span>
          </button>
        </div>

        {/* Tab bar — overflow-x-auto per schermi stretti */}
        <div className="flex items-center gap-0 border-b border-brand-200 overflow-x-auto scrollbar-none">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0',
                activeTab === key
                  ? 'border-brand-900 text-brand-900'
                  : 'border-transparent text-brand-500 hover:text-brand-800',
              )}
            >
              {key === 'pending' && <Clock size={13} className="shrink-0" />}
              {key === 'favorites' && (
                <Heart
                  size={13}
                  className={clsx('shrink-0', activeTab === 'favorites' ? 'text-red-400 fill-red-400' : '')}
                />
              )}
              {label}
              {count > 0 && (
                <span className={clsx(
                  'text-xs rounded-full px-1.5 py-0.5 font-medium leading-none',
                  activeTab === key ? 'bg-brand-900 text-white' : 'bg-brand-100 text-brand-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand-900 border-t-transparent animate-spin" />
            <p className="text-sm text-brand-400">Caricamento...</p>
          </div>
        ) : tabOutfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-400">
              {activeTab === 'favorites'
                ? <Heart size={24} />
                : activeTab === 'pending'
                  ? <Clock size={24} />
                  : <Camera size={24} />}
            </div>
            <p className="text-sm text-brand-500 max-w-xs">{emptyMessages[activeTab]}</p>
          </div>
        ) : (
          /* Colonna centrata: stretta su mobile (stile Instagram), leggermente più larga su desktop */
          <div className="mx-auto w-full max-w-sm md:max-w-md space-y-4">
            {tabOutfits.map((outfit) =>
              activeTab === 'pending' ? (
                <PendingCard
                  key={outfit.id}
                  outfit={outfit}
                  onFavorite={toggleFavorite}
                  onDelete={remove}
                  onGenerateTryOn={setTryOnTarget}
                />
              ) : (
                <FeedCard
                  key={outfit.id}
                  outfit={outfit}
                  onFavorite={toggleFavorite}
                  onDelete={remove}
                />
              )
            )}
          </div>
        )}
      </div>

      <GenerateOutfitModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={() => setActiveTab('pending')}
      />

      <TryOnModal
        outfit={tryOnTarget}
        open={!!tryOnTarget}
        onClose={() => setTryOnTarget(null)}
      />
    </>
  )
}
