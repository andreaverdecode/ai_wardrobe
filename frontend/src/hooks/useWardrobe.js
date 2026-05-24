import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  getClothing,
  uploadClothing,
  updateClothing,
  deleteClothing,
  reanalyzeClothing,
} from '../api/client.js'

export const WARDROBE_KEY = 'wardrobe'

const defaultFilters = {
  category: '',
  season:   '',
  color:    '',
  search:   '',
}

export function useWardrobe() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState(defaultFilters)
  const [uploadProgress, setUploadProgress] = useState(0)

  // ─── Query ───────────────────────────────────────────────────
  const {
    data: clothing = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [WARDROBE_KEY, filters],
    queryFn:  () => getClothing(filters).then((r) => r.items ?? r),
  })

  // ─── Upload ──────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: ({ formData }) =>
      uploadClothing(formData, (pct) => setUploadProgress(pct)),
    onSuccess: () => {
      toast.success('Vestito aggiunto con successo!')
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY] })
      setUploadProgress(0)
    },
    onError: () => {
      setUploadProgress(0)
    },
  })

  // ─── Update ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateClothing(id, data),
    onSuccess: () => {
      toast.success('Vestito aggiornato.')
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY] })
    },
  })

  // ─── Delete ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClothing(id),
    onSuccess: () => {
      toast.success('Vestito eliminato.')
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY] })
    },
  })

  // ─── Reanalyze ───────────────────────────────────────────────
  const reanalyzeMutation = useMutation({
    mutationFn: (id) => reanalyzeClothing(id),
    onSuccess: () => {
      toast.success('Analisi completata.')
      qc.invalidateQueries({ queryKey: [WARDROBE_KEY] })
    },
  })

  // ─── Filter helpers ──────────────────────────────────────────
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return {
    clothing,
    isLoading,
    isError,
    error,
    refetch,

    filters,
    setFilter,
    resetFilters,
    activeFilterCount,

    uploadProgress,
    upload:    uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    uploadedItem: uploadMutation.data,

    update:    updateMutation.mutate,
    isUpdating: updateMutation.isPending,

    remove:    deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,

    reanalyze: reanalyzeMutation.mutate,
    isReanalyzing: reanalyzeMutation.isPending,
  }
}
