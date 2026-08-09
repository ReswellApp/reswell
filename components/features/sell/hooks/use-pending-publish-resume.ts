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
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (!options.draftHydrated || options.editId || pendingPublishHandledRef.current) return
    let cancelled = false

    const tryResume = async () => {
      const opts = optionsRef.current
      if (pendingPublishHandledRef.current || cancelled || opts.editId) return
      if (!isPendingPublish(opts.listingKind)) return

      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      if (!user || cancelled) return

      pendingPublishHandledRef.current = true
      clearPendingPublish(opts.listingKind)

      for (let i = 0; i < 120 && !cancelled; i++) {
        const imgs = opts.imagesRef.current
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
        opts.formRef.current?.requestSubmit()
      })
    }

    void tryResume()

    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void tryResume()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [options.draftHydrated, options.editId, options.listingKind])
}
