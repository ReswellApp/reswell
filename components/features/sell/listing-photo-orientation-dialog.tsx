"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ListingPhotoOrientationPreview, ListingPhotoRotateControls } from "@/components/features/listings/listing-photo-orientation-controls"
import type { ListingPhotoQuarterTurnDelta, ListingPhotoQuarterTurns } from "@/lib/sell-flow/listing-photo-orientation"

interface ListingPhotoOrientationDialogProps {
  open: boolean
  src: string
  saving?: boolean
  onOpenChange: (open: boolean) => void
  onApply: (quarterTurns: ListingPhotoQuarterTurnDelta) => void
}

export function ListingPhotoOrientationDialog({
  open,
  src,
  saving = false,
  onOpenChange,
  onApply,
}: ListingPhotoOrientationDialogProps) {
  const [quarterTurns, setQuarterTurns] = useState<ListingPhotoQuarterTurns>(0)

  useEffect(() => {
    if (!open) return
    setQuarterTurns(0)
  }, [open, src])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-photo-orientation-title"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <button
          type="button"
          className="min-h-11 min-w-14 text-left text-[17px] font-normal text-white/90"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </button>
        <h2 id="listing-photo-orientation-title" className="text-[17px] font-semibold tracking-tight">
          Straighten photo
        </h2>
        <button
          type="button"
          className="min-h-11 min-w-14 text-right text-[17px] font-semibold text-[#0a84ff] disabled:opacity-40"
          disabled={saving || quarterTurns === 0}
          onClick={() => {
            if (quarterTurns === 0) return
            onApply(quarterTurns)
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-4">
        <ListingPhotoOrientationPreview
          src={src}
          quarterTurns={quarterTurns}
          className="max-w-[28rem]"
        />
      </div>

      <div className="mx-auto w-full max-w-md px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <ListingPhotoRotateControls
          quarterTurns={quarterTurns}
          onQuarterTurnsChange={setQuarterTurns}
          disabled={saving}
        />
      </div>
    </div>,
    document.body,
  )
}
