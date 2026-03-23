"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

const PHOTOS_PENDING_PARAM = "photos"
const PHOTOS_PENDING_VALUE = "pending"

function ListingPhotosPendingBannerInner({
  imageCount,
  isOwner,
}: {
  imageCount: number
  isOwner: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pending =
    isOwner && searchParams.get(PHOTOS_PENDING_PARAM) === PHOTOS_PENDING_VALUE
  const showBanner = pending && imageCount === 0
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!pending || imageCount > 0) return

    router.refresh()
    const maxAttempts = 45
    const id = setInterval(() => {
      attemptsRef.current += 1
      router.refresh()
      if (attemptsRef.current >= maxAttempts) {
        clearInterval(id)
      }
    }, 2000)

    return () => clearInterval(id)
  }, [pending, imageCount, router])

  useEffect(() => {
    if (!pending || imageCount === 0) return
    const next = new URLSearchParams(searchParams.toString())
    next.delete(PHOTOS_PENDING_PARAM)
    const q = next.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [pending, imageCount, pathname, router, searchParams])

  if (!showBanner) return null

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      <span>Your listing is live. Photos are still uploading — this usually takes a few seconds.</span>
    </div>
  )
}

/**
 * After a fast redirect from /sell, polls the server so images appear as soon as background uploads finish.
 * Wrapped in Suspense for useSearchParams (Next.js App Router).
 */
export function ListingPhotosPendingBanner(props: {
  imageCount: number
  isOwner: boolean
}) {
  return (
    <Suspense fallback={null}>
      <ListingPhotosPendingBannerInner {...props} />
    </Suspense>
  )
}
