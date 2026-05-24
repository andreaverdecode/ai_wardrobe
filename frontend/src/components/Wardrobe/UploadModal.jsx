import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, ImageIcon, CheckCircle, AlertCircle, Loader2, Camera } from 'lucide-react'
import clsx from 'clsx'
import { useScrollLock } from '../../hooks/useScrollLock.js'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

function AnalysisResult({ item }) {
  if (!item) return null
  return (
    <div className="mt-4 p-4 rounded-xl bg-brand-50 border border-brand-200 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
        Analisi AI completata
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {item.category && (
          <div>
            <span className="label">Categoria</span>
            <span className="text-brand-800">{item.category}</span>
          </div>
        )}
        {item.season && (
          <div>
            <span className="label">Stagione</span>
            <span className="text-brand-800">{item.season}</span>
          </div>
        )}
        {item.style && (
          <div className="col-span-2">
            <span className="label">Stile</span>
            <span className="text-brand-800">{item.style}</span>
          </div>
        )}
        {item.colors?.length > 0 && (
          <div className="col-span-2">
            <span className="label">Colori</span>
            <div className="flex items-center gap-1.5 mt-1">
              {item.colors.map((c, i) => (
                <span
                  key={i}
                  className="w-5 h-5 rounded-full border border-white ring-1 ring-brand-200"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {item.description && (
        <p className="text-xs text-brand-500 leading-relaxed border-t border-brand-200 pt-2">
          {item.description}
        </p>
      )}
    </div>
  )
}

export default function UploadModal({ open, onClose, onUpload, isUploading, uploadProgress, uploadedItem }) {
  const [file, setFile]     = useState(null)
  const [preview, setPreview] = useState(null)
  const [name, setName]     = useState('')
  const [error, setError]   = useState('')
  const cameraInputRef      = useRef(null)
  useScrollLock(open)

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview(null)
      setName('')
      setError('')
    }
  }, [open])

  // Release object URL on unmount
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const onDrop = useCallback((accepted, rejected) => {
    setError('')
    if (rejected.length > 0) {
      const reason = rejected[0].errors?.[0]?.code
      if (reason === 'file-too-large') setError('Il file supera i 10 MB.')
      else if (reason === 'file-invalid-type') setError('Formato non supportato. Usa JPG, PNG o WebP.')
      else setError('File non valido.')
      return
    }
    if (accepted.length > 0) {
      const f = accepted[0]
      setFile(f)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(f))
    }
  }, [preview])

  function handleCameraChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(f))
    e.target.value = ''
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: isUploading,
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError("Seleziona un'immagine."); return }
    const formData = new FormData()
    formData.append('file', file)
    if (name.trim()) formData.append('name', name.trim())
    onUpload({ formData })
  }

  const isDone = !!uploadedItem && !isUploading

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!isUploading ? onClose : undefined}
      />

      {/* Panel */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-modal overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100">
          <h2 id="upload-modal-title" className="text-base font-semibold text-brand-900">
            Aggiungi vestito
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="btn-ghost p-1.5 rounded-lg disabled:opacity-40"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Drop zone */}
          {!preview ? (
            <div className="space-y-3">
              <div
                {...getRootProps()}
                className={clsx(
                  'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-brand-700 bg-brand-50'
                    : 'border-brand-200 bg-brand-50/50 hover:border-brand-400 hover:bg-brand-50',
                )}
              >
                <input {...getInputProps()} />
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 text-brand-500">
                  <Upload size={22} />
                </span>
                <div>
                  <p className="text-sm font-medium text-brand-800">
                    {isDragActive ? 'Rilascia qui' : 'Trascina un\'immagine o clicca'}
                  </p>
                  <p className="text-xs text-brand-400 mt-0.5">JPG, PNG, WebP — max 10 MB</p>
                </div>
              </div>

              {/* Camera button — visibile e utile su mobile */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraChange}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="btn-secondary w-full"
              >
                <Camera size={16} />
                Scatta una foto
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-brand-50 aspect-[4/3]">
              <img src={preview} alt="Anteprima" className="w-full h-full object-contain" />
              {!isUploading && !isDone && (
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null) }}
                  className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-white/90 shadow text-brand-600 hover:text-brand-900"
                  aria-label="Rimuovi immagine"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-500">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  {uploadProgress < 100 ? 'Caricamento...' : 'Analisi AI in corso...'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-brand-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-900 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Analysis result */}
          {isDone && <AnalysisResult item={uploadedItem} />}

          {/* Name field */}
          {!isDone && (
            <div>
              <label htmlFor="clothing-name" className="label">
                Nome <span className="text-brand-300 font-normal">(opzionale — generato da AI)</span>
              </label>
              <input
                id="clothing-name"
                type="text"
                className="input"
                placeholder="Es. Camicia Oxford blu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUploading}
                maxLength={120}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            {isDone ? (
              <button type="button" onClick={onClose} className="btn-primary flex-1">
                Fatto
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isUploading}
                  className="btn-secondary flex-1"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="btn-primary flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Caricamento...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={15} />
                      Carica e analizza
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
