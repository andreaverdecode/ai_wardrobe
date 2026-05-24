import axios from 'axios'
import toast from 'react-hot-toast'
import { getUserId } from '../utils/userId.js'

// ─── Axios instance ───────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const userId = getUserId()

    // Aggiunge user_id come query param (usato dalla maggior parte degli endpoint)
    config.params = { ...config.params, user_id: userId }

    // Per body JSON, inietta user_id nel body (es. POST /outfits/generate)
    if (config.data && !(config.data instanceof FormData)) {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
      config.data = { ...body, user_id: userId }
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ─── Response interceptor ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.detail || error.response?.data?.message

    if (status === 422) {
      const validationErrors = error.response?.data?.detail
      if (Array.isArray(validationErrors)) {
        const msg = validationErrors.map((e) => e.msg).join(', ')
        toast.error(`Errore di validazione: ${msg}`)
      } else {
        toast.error('Dati non validi. Controlla il form.')
      }
    } else if (status === 404) {
      toast.error('Risorsa non trovata.')
    } else if (status === 500) {
      toast.error('Errore del server. Riprova tra poco.')
    } else if (!status) {
      toast.error('Impossibile raggiungere il server.')
    } else if (message) {
      toast.error(message)
    }

    return Promise.reject(error)
  },
)

// ─── Clothing ─────────────────────────────────────────────────────

/**
 * @param {{ category?: string, season?: string, color?: string, search?: string }} filters
 */
export function getClothing(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  return api.get('/clothing', { params }).then((r) => r.data)
}

/**
 * @param {FormData} formData
 * @param {(progress: number) => void} [onProgress]
 */
export function uploadClothing(formData, onProgress) {
  return api
    .post('/clothing/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100))
        }
      },
    })
    .then((r) => r.data)
}

/**
 * @param {string|number} id
 * @param {object} data
 */
export function updateClothing(id, data) {
  return api.put(`/clothing/${id}`, data).then((r) => r.data)
}

/**
 * @param {string|number} id
 */
export function deleteClothing(id) {
  return api.delete(`/clothing/${id}`).then((r) => r.data)
}

/**
 * @param {string|number} id
 */
export function reanalyzeClothing(id) {
  return api.post(`/clothing/${id}/analyze`).then((r) => r.data)
}

// ─── Outfits ──────────────────────────────────────────────────────

/**
 * @param {{ occasion?: string, season?: string, count?: number }} params
 */
export function generateOutfits(params = {}) {
  return api.post('/outfits/generate', params).then((r) => r.data)
}

/**
 * @param {{ favorites?: boolean, occasion?: string, season?: string }} filters
 */
export function getOutfits(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  return api.get('/outfits', { params }).then((r) => r.data)
}

/**
 * @param {string|number} id
 */
export function toggleFavoriteOutfit(id) {
  return api.post(`/outfits/${id}/favorite`).then((r) => r.data)
}

/**
 * @param {string|number} id
 */
export function deleteOutfit(id) {
  return api.delete(`/outfits/${id}`).then((r) => r.data)
}

// ─── Try-On ───────────────────────────────────────────────────────

/**
 * @param {{ gender?: string, style?: string }} params
 */
export function generateModel(params = {}) {
  return api.post('/tryon/generate-model', params).then((r) => r.data)
}

/**
 * @param {{ model_id: string|number, clothing_id: string|number }} params
 */
export function applyTryOn(params) {
  return api.post('/tryon/apply', params).then((r) => r.data)
}

/**
 * @param {string|number} id
 */
export function getJobStatus(id) {
  return api.get(`/tryon/jobs/${id}`).then((r) => r.data)
}

/**
 * Polls a job until it reaches a terminal state (completed / failed).
 * @param {string} jobId
 * @param {{ maxWaitMs?: number, intervalMs?: number }} options
 * @returns {Promise<object>} Resolved job object
 */
export async function pollJobUntilDone(jobId, { maxWaitMs = 300_000, intervalMs = 3_000 } = {}) {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const job = await getJobStatus(jobId)
    if (job.status === 'completed' || job.status === 'failed') return job
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('Timeout: elaborazione Replicate troppo lunga (>5 min)')
}

export default api
