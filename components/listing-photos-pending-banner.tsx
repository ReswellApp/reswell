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

  // CLS-FIX: render as a fixed overlay so the banner never pushes page
  // content down — the null→visible transition is position-fixed and
  // therefore outside the document flow.
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex max-w-sm items-center gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 text-sm text-muted-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
