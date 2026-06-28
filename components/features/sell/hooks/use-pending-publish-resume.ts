"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  clearPendingPublish,
  isPendingPublish,
  type SellFlowListingKind,
} from "@/lib/sell-flow/session-keys"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"

export function usePendingPublishResume(options: {
  listingKind: SellFlowListingKind
  editId: string | null
  draftHydrated: boolean
  formRef: React.RefObject<HTMLFormElement | null>
  imagesRef: React.MutableRefObject<ListingPhotoSlot[]>
}): void {
  const pendingPublishHandledRef = useRef(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!options.draftHydrated || options.editId || pendingPublishHandledRef.current) return
    let cancelled = false

    void (async () => {
      if (!isPendingPublish(options.listingKind)) return

      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      if (!user || cancelled) return

      pendingPublishHandledRef.current = true
      clearPendingPublish(options.listingKind)

      for (let i = 0; i < 120 && !cancelled; i++) {
        const imgs = options.imagesRef.current
        const workLeft = imgs.some(
          (im) =>
            im.sourceFile &&
            (im.optimizePhase === "running" ||
              im.uploadPhase === "uploading" ||
              (im.optimizePhase === "done" &&
                im.uploadPhase !== "done" &&
                im.uploadPhase !== "error")),
        )
        if (!workLeft) break
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      if (cancelled) return
      window.requestAnimationFrame(() => {
        options.formRef.current?.requestSubmit()
      })
    })()

    return () => {
      cancelled = true
    }
  }, [options.draftHydrated, options.editId, options.formRef, options.imagesRef, options.listingKind])
}
