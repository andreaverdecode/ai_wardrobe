import { Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getOutfits } from '../api/client.js'
import { OUTFITS_KEY } from '../hooks/useOutfits.js'
import TryOnPanel from '../components/TryOn/TryOnPanel.jsx'

export default function TryOnPage() {
  const { data: outfits = [], isLoading } = useQuery({
    queryKey: [OUTFITS_KEY, {}],
    queryFn: () => getOutfits({}).then((r) => r.items ?? r),
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900 tracking-tight">Try-On virtuale</h1>
          <p className="text-sm text-brand-400 mt-0.5">
            Prova i tuoi outfit su un modello generato dall'AI
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-brand-400">
          <Sparkles size={13} />
          Powered by AI
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-900 border-t-transparent animate-spin" />
          <p className="text-sm text-brand-400">Caricamento outfit...</p>
        </div>
      ) : (
        <TryOnPanel outfits={outfits} />
      )}
    </div>
  )
}
