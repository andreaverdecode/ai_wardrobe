import { useState } from 'react'
import { Loader2, Check, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Star, Heart, ShoppingBag } from 'lucide-react'
import clsx from 'clsx'
import { generateModel, applyTryOn, pollJobUntilDone } from '../../api/client.js'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, label: 'Scegli outfit' },
  { id: 2, label: 'Modello AI'   },
  { id: 3, label: 'Risultato'    },
]

const GENDERS = [
  { value: 'female', label: 'Donna' },
  { value: 'male',   label: 'Uomo'  },
]

const PHOTO_STYLES = [
  { value: 'fashion editorial', label: 'Studio'    },
  { value: 'outdoor lifestyle', label: 'Outdoor'   },
  { value: 'street style',      label: 'Street'    },
]

// Capo principale per anteprima (non per il try-on)
const PREVIEW_PRIORITY = ['dress', 'outerwear', 'top', 'bottom', 'shoes', 'accessory', 'bag']

function pickMainItem(outfit) {
  if (!outfit?.items?.length) return null
  for (const cat of PREVIEW_PRIORITY) {
    const found = outfit.items.find((i) => i.category === cat)
    if (found) return found
  }
  return outfit.items[0]
}

// Costruisce la catena di capi da applicare in sequenza (inner → outer)
// IDM-VTON non gestisce bene scarpe/accessori → li escludiamo
const CHAIN_ORDER = ['bottom', 'top', 'outerwear']

function buildGarmentChain(outfit) {
  if (!outfit?.items?.length) return []
  const dress = outfit.items.find((i) => i.category === 'dress')
  if (dress) return [dress]
  return CHAIN_ORDER
    .map((cat) => outfit.items.find((i) => i.category === cat))
    .filter(Boolean)
    .slice(0, 3) // max 3 capi per contenere costi e tempi
}

// ─── Step indicator ───────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              current > step.id  ? 'bg-brand-900 text-white'
              : current === step.id ? 'bg-brand-900 text-white ring-4 ring-brand-200'
              : 'bg-brand-100 text-brand-400',
            )}>
              {current > step.id ? <Check size={15} /> : step.id}
            </div>
            <span className={clsx(
              'text-xs font-medium whitespace-nowrap',
              current >= step.id ? 'text-brand-800' : 'text-brand-400',
            )}>
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={clsx('flex-1 h-0.5 mx-2 rounded transition-colors', current > step.id ? 'bg-brand-900' : 'bg-brand-200')}
              style={{ marginBottom: '1.25rem' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function AILoadingState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
        <div className="absolute inset-0 rounded-full border-4 border-brand-900 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-brand-600 text-center max-w-xs">{message}</p>
    </div>
  )
}

// ─── Outfit selector (Step 1) ─────────────────────────────────────
function OutfitSelector({ outfits, selected, onSelect }) {
  if (!outfits.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-brand-400">
          <ShoppingBag size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-brand-700">Nessun outfit disponibile</p>
          <p className="text-xs text-brand-400 mt-1">
            Genera prima degli outfit nella sezione Outfit.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {outfits.map((outfit) => {
        const isSelected = selected?.id === outfit.id
        const mainItem = pickMainItem(outfit)

        return (
          <button
            key={outfit.id}
            type="button"
            onClick={() => onSelect(outfit)}
            className={clsx(
              'relative text-left rounded-xl border-2 p-3 transition-all duration-150 space-y-3',
              isSelected
                ? 'border-brand-900 ring-2 ring-brand-900/20 bg-brand-50'
                : 'border-brand-200 hover:border-brand-400 bg-white',
            )}
          >
            {/* Outfit name + score */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-brand-900 leading-snug">{outfit.name}</p>
              {outfit.style_score != null && (
                <span className="shrink-0 flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  {outfit.style_score}/10
                </span>
              )}
            </div>

            {/* Items thumbnails */}
            {outfit.items?.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {outfit.items.slice(0, 5).map((item) => (
                  <div
                    key={item.id ?? item.clothing_id}
                    className="w-12 h-12 rounded-lg overflow-hidden bg-brand-100 border border-brand-200 shrink-0"
                  >
                    {item.image_path ? (
                      <img src={`/${item.image_path}`} alt={item.name ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-300 text-xs">
                        {item.category?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Occasion + badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {outfit.occasion && (
                <span className="badge bg-brand-100 text-brand-600">{outfit.occasion}</span>
              )}
              {outfit.is_favorite && (
                <Heart size={12} className="text-red-400 fill-red-400" />
              )}
            </div>

            {/* Selected checkmark */}
            {isSelected && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-900 flex items-center justify-center">
                <Check size={11} className="text-white" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Model options (Step 2) ───────────────────────────────────────
function ModelOptions({ outfit, gender, style, onChange }) {
  const mainItem = pickMainItem(outfit)

  return (
    <div className="space-y-6">
      {/* Outfit recap */}
      {outfit && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 space-y-2">
          <p className="text-xs font-medium text-brand-500">Outfit selezionato</p>
          <p className="text-sm font-semibold text-brand-900">{outfit.name}</p>
          {mainItem && (
            <p className="text-xs text-brand-400">
              Capo principale: <span className="text-brand-700">{mainItem.garment_type ?? mainItem.name ?? mainItem.category}</span>
            </p>
          )}
        </div>
      )}

      <div>
        <label className="label text-sm mb-2 block">Genere modello</label>
        <div className="flex gap-3">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => onChange('gender', g.value)}
              className={clsx(
                'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                gender === g.value
                  ? 'border-brand-900 bg-brand-900 text-white'
                  : 'border-brand-200 text-brand-700 hover:border-brand-400',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label text-sm mb-2 block">Stile foto</label>
        <div className="flex gap-3">
          {PHOTO_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange('style', s.value)}
              className={clsx(
                'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                style === s.value
                  ? 'border-brand-900 bg-brand-900 text-white'
                  : 'border-brand-200 text-brand-700 hover:border-brand-400',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Result (Step 3) ──────────────────────────────────────────────
function TryOnResult({ outfit, result, onReset }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const chain = buildGarmentChain(outfit)
  // Preferisce il path locale (permanente) all'URL Replicate (scade)
  const imageUrl = result?.output_data?.image_path
    ? `/${result.output_data.image_path}`
    : result?.output_data?.image_url

  return (
    <div className="space-y-4">
      {/* Hero image */}
      <div className="relative rounded-2xl overflow-hidden bg-brand-100 shadow-lg">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Virtual try-on"
            className="w-full object-cover"
            style={{ maxHeight: '70vh' }}
          />
        ) : (
          <div className="aspect-[3/4] flex items-center justify-center text-brand-300 text-sm">
            Immagine non disponibile
          </div>
        )}
        {/* Outfit name badge overlay */}
        {outfit?.name && (
          <div className="absolute bottom-3 left-3 right-3">
            <span className="inline-block bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg">
              {outfit.name}
            </span>
          </div>
        )}
      </div>

      {/* Capi usati + dettagli (collassabile) */}
      <div className="rounded-xl border border-brand-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-brand-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {chain.slice(0, 4).map((item) => (
                <div
                  key={item.id ?? item.clothing_id}
                  className="w-7 h-7 rounded-full overflow-hidden border-2 border-white bg-brand-100 shrink-0"
                >
                  {item.image_path ? (
                    <img src={`/${item.image_path}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-200" />
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs font-medium text-brand-700">
              {chain.length} {chain.length === 1 ? 'capo applicato' : 'capi applicati'}
            </span>
          </div>
          {detailsOpen ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
        </button>

        {detailsOpen && (
          <div className="px-4 pb-4 pt-2 bg-brand-50 space-y-3 border-t border-brand-200">
            <div className="flex flex-wrap gap-3">
              {chain.map((item) => (
                <div key={item.id ?? item.clothing_id} className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-brand-100 border border-brand-200 shrink-0">
                    {item.image_path ? (
                      <img src={`/${item.image_path}`} alt={item.name ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-300 text-xs">
                        {item.category?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-brand-800">{item.garment_type ?? item.name ?? item.category}</p>
                    <p className="text-xs text-brand-400 capitalize">{item.category}</p>
                  </div>
                </div>
              ))}
            </div>
            {outfit?.reasoning && (
              <p className="text-xs text-brand-500 leading-relaxed border-t border-brand-200 pt-3">
                {outfit.reasoning}
              </p>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={onReset} className="btn-secondary w-full">
        <RotateCcw size={15} />
        Prova un altro outfit
      </button>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────
export default function TryOnPanel({ outfits = [] }) {
  const [step, setStep]             = useState(1)
  const [selectedOutfit, setSelectedOutfit] = useState(null)
  const [modelOptions, setModelOptions] = useState({ gender: 'female', style: 'fashion editorial' })
  const [tryOnResult, setTryOnResult]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  function handleOptionChange(key, value) {
    setModelOptions((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGenerateTryOn() {
    const mainItem = pickMainItem(selectedOutfit)
    if (!mainItem?.image_path) {
      toast.error('Il capo selezionato non ha un\'immagine.')
      return
    }

    setLoading(true)
    try {
      // Step 1: avvia generazione modello (risposta immediata con job_id)
      setLoadingMsg('Avvio generazione modello base...')
      const modelJobPending = await generateModel(modelOptions)

      // Step 2: polling fino al completamento (può richiedere 30-90 secondi)
      setLoadingMsg('Generazione modello AI in corso... (attendere ~1 min)')
      const modelJob = await pollJobUntilDone(modelJobPending.id)
      if (modelJob.status === 'failed') throw new Error(modelJob.error_message ?? 'Generazione modello fallita')

      const modelImageUrl = modelJob.output_data?.image_url
      if (!modelImageUrl) throw new Error('URL immagine modello non disponibile')

      // Step 3: costruisci catena di capi e avvia il try-on sequenziale
      const chain = buildGarmentChain(selectedOutfit)
      if (!chain.length) throw new Error('Nessun capo valido nell\'outfit per il try-on.')

      const garmentItems = chain.map((item) => ({
        image_path:  item.image_path,
        description: item.garment_type ?? item.ai_description ?? item.name ?? item.category ?? '',
        category:    item.category ?? 'top',
      }))

      const chainLabel = chain.length === 1
        ? `1 capo (${chain[0].garment_type ?? chain[0].category})`
        : `${chain.length} capi in sequenza`

      setLoadingMsg(`Avvio try-on: ${chainLabel}...`)
      const tryonJobPending = await applyTryOn({
        model_image_url: modelImageUrl,
        garment_items:   garmentItems,
        outfit_id:       selectedOutfit.id,
      })

      // Step 4: polling try-on (1-3 min per capo)
      const estMin = chain.length * 2
      setLoadingMsg(`Try-on in corso: ${chainLabel}... (~${estMin}-${estMin + chain.length} min)`)
      const result = await pollJobUntilDone(tryonJobPending.id)
      if (result.status === 'failed') throw new Error(result.error_message ?? 'Try-on fallito')

      setTryOnResult(result)
      setStep(3)
    } catch (err) {
      toast.error(err.message ?? 'Errore durante il try-on. Riprova.')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  function handleReset() {
    setStep(1)
    setSelectedOutfit(null)
    setTryOnResult(null)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator current={step} />

      {loading ? (
        <AILoadingState message={loadingMsg} />
      ) : step === 1 ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold text-brand-900 mb-1">Scegli un outfit</h3>
            <p className="text-sm text-brand-500">Seleziona l'outfit che vuoi provare virtualmente.</p>
          </div>
          <OutfitSelector outfits={outfits} selected={selectedOutfit} onSelect={setSelectedOutfit} />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => { if (!selectedOutfit) { toast.error('Seleziona un outfit.'); return } setStep(2) }}
              disabled={!selectedOutfit}
              className="btn-primary"
            >
              Continua
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold text-brand-900 mb-1">Impostazioni modello</h3>
            <p className="text-sm text-brand-500">Personalizza il modello su cui visualizzare l'outfit.</p>
          </div>
          <ModelOptions
            outfit={selectedOutfit}
            gender={modelOptions.gender}
            style={modelOptions.style}
            onChange={handleOptionChange}
          />
          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => setStep(1)} className="btn-ghost">Indietro</button>
            <button type="button" onClick={handleGenerateTryOn} className="btn-primary">
              Genera try-on
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <TryOnResult outfit={selectedOutfit} result={tryOnResult} onReset={handleReset} />
      )}
    </div>
  )
}
