"use client"

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { toast } from "sonner"
import {
  canRotateSimpleSellPhoto,
  simpleSellPhotoSlotForRotate180,
  type SimpleSellPhotoSlot,
} from "@/lib/sell-flow/simple-listing-photo-rotate"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"

export function useSimpleListingPhotoRotate<T extends SimpleSellPhotoSlot>({
  photosRef,
  setPhotos,
  uploadSlot,
}: {
  photosRef: MutableRefObject<T[]>
  setPhotos: Dispatch<SetStateAction<T[]>>
  uploadSlot: (slot: T) => void | Promise<void>
}): (clientId: string) => void {
  return useCallback(
    (clientId: string) => {
      const live = photosRef.current.find((p) => p.clientId === clientId)
      if (!live || !canRotateSimpleSellPhoto(live)) return

      const snapshot = live
      setPhotos((prev) =>
        prev.map((p) =>
          p.clientId === clientId ? { ...p, phase: "optimizing", progress: 0 } : p,
        ),
      )

      void (async () => {
        try {
          const next = await simpleSellPhotoSlotForRotate180(live)
          if (!photosRef.current.some((p) => p.clientId === clientId)) return
          setPhotos((prev) => prev.map((p) => (p.clientId === clientId ? next : p)))
          await uploadSlot(next)
        } catch (e) {
          toast.error(friendlyListingPhotoErrorMessage(e, "rotate"))
          setPhotos((prev) => {
            if (!prev.some((p) => p.clientId === clientId)) return prev
            return prev.map((p) => (p.clientId === clientId ? snapshot : p))
          })
        }
      })()
    },
    [photosRef, setPhotos, uploadSlot],
  )
}
