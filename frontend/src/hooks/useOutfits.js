import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getOutfits,
  generateOutfits,
  toggleFavoriteOutfit,
  deleteOutfit,
} from '../api/client.js'

export const OUTFITS_KEY = 'outfits'

const defaultGenerateParams = {
  occasion: '',
  season:   '',
  count:    4,
}

export function useOutfits() {
  const qc = useQueryClient()
  const [generateParams, setGenerateParams] = useState(defaultGenerateParams)
  const [filterFavorites, setFilterFavorites] = useState(false)

  // ─── Query ───────────────────────────────────────────────────
  const {
    data: outfits = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [OUTFITS_KEY, { favorites: filterFavorites || undefined }],
    queryFn:  () => getOutfits(filterFavorites ? { is_favorite: true } : {}).then((r) => r.items ?? r),
  })

  const favorites = outfits.filter((o) => o.is_favorite)

  // ─── Generate ────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (params) => generateOutfits(params ?? generateParams),
    onSuccess: () => {
      toast.success('Outfit generati con successo!')
      qc.invalidateQueries({ queryKey: [OUTFITS_KEY] })
    },
  })

  // ─── Toggle favorite ─────────────────────────────────────────
  const favoriteMutation = useMutation({
    mutationFn: (id) => toggleFavoriteOutfit(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [OUTFITS_KEY] })
      const snapshot = qc.getQueryData([OUTFITS_KEY])
      qc.setQueriesData({ queryKey: [OUTFITS_KEY] }, (old = []) =>
        old.map((o) => (o.id === id ? { ...o, is_favorite: !o.is_favorite } : o)),
      )
      return { snapshot }
    },
    onError: (_err, _id, ctx) => {
      qc.setQueryData([OUTFITS_KEY], ctx.snapshot)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [OUTFITS_KEY] })
    },
  })

  // ─── Delete ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteOutfit(id),
    onSuccess: () => {
      toast.success('Outfit eliminato.')
      qc.invalidateQueries({ queryKey: [OUTFITS_KEY] })
    },
  })

  // ─── Param helpers ───────────────────────────────────────────
  const setParam = useCallback((key, value) => {
    setGenerateParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetParams = useCallback(() => {
    setGenerateParams(defaultGenerateParams)
  }, [])

  return {
    outfits,
    favorites,
    isLoading,
    isError,
    error,
    refetch,

    generateParams,
    setParam,
    resetParams,

    filterFavorites,
    setFilterFavorites,

    generate:     (params) => generateMutation.mutate(params),
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,

    toggleFavorite:     (id) => favoriteMutation.mutate(id),
    isTogglingFavorite: favoriteMutation.isPending,

    remove:    (id) => deleteMutation.mutate(id),
    isDeleting: deleteMutation.isPending,
  }
}
