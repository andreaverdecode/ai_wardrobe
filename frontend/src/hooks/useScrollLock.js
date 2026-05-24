import { useEffect } from 'react'

/**
 * Blocca lo scroll del body quando `active` è true.
 * Usa position:fixed per garantire il blocco anche su iOS Safari,
 * e ripristina la posizione di scroll al momento della chiusura.
 */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return

    const scrollY = window.scrollY
    const body    = document.body

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top      = `-${scrollY}px`
    body.style.width    = '100%'

    return () => {
      body.style.overflow = ''
      body.style.position = ''
      body.style.top      = ''
      body.style.width    = ''
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    }
  }, [active])
}
