import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

/** Load an image from a Bearer-protected API path (axios base URL `/api`). */
export function AuthenticatedApiImage({
  apiPath,
  alt,
  className,
}: {
  apiPath: string | null | undefined
  alt: string
  className?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const trimmed = apiPath?.trim() ?? ''

  useEffect(() => {
    if (!trimmed) return

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
  }, [trimmed])

  if (!trimmed || !blobUrl) return null
  return <img src={blobUrl} alt={alt} className={className} />
}
