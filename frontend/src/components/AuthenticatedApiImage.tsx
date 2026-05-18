import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/** Load an image from a Bearer-protected API path (axios base URL `/api`). */
export function AuthenticatedApiImage({
  apiPath,
  alt,
  className,
  lazy,
}: {
  apiPath: string | null | undefined
  alt: string
  className?: string
  /** When true, defer network fetch until the placeholder enters the viewport. */
  lazy?: boolean
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const eagerLoad = !lazy
  const [lazyReveal, setLazyReveal] = useState(false)
  const shouldLoad = eagerLoad || lazyReveal
  const placeholderRef = useRef<HTMLDivElement>(null)

  const trimmed = apiPath?.trim() ?? ''

  useEffect(() => {
    if (shouldLoad) return
    const el = placeholderRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setLazyReveal(true)
      },
      { rootMargin: '160px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shouldLoad])

  useEffect(() => {
    if (!trimmed || !shouldLoad) return

    const path = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
    let cancelled = false

    void api
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
        }
        const u = URL.createObjectURL(res.data)
        urlRef.current = u
        setBlobUrl(u)
      })
      .catch(() => {
        if (cancelled) return
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current)
          urlRef.current = null
        }
        setBlobUrl(null)
      })

    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [trimmed, shouldLoad])

  if (!trimmed) return null

  if (!shouldLoad) {
    return (
      <div
        ref={placeholderRef}
        className={className}
        aria-hidden
        style={{ minHeight: '12rem' }}
      />
    )
  }

  if (!blobUrl) return <div className={className} style={{ minHeight: '8rem' }} />

  return <img src={blobUrl} alt={alt} className={className} loading="lazy" />
}
