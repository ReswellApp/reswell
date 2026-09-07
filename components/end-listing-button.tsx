"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EndListingDialog } from "@/components/end-listing-dialog"
import { prefetchSaleTipCheckout } from "@/lib/stripe/prefetch-sale-tip-checkout"

interface EndListingButtonProps {
  listingId: string
  listingPriceUsd?: number
  listingStatus?: string | null
  vacationMode?: boolean
  canDelete?: boolean
  /** Applied to the primary trigger button only (dialog buttons unchanged). */
  triggerClassName?: string
}

export function EndListingButton({
  listingId,
  listingPriceUsd,
  listingStatus,
  vacationMode,
  canDelete,
  triggerClassName,
}: EndListingButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        className={triggerClassName}
        onPointerEnter={() => {
          void prefetchSaleTipCheckout()
        }}
        onClick={() => setOpen(true)}
      >
        End listing
      </Button>
      <EndListingDialog
        listingId={listingId}
        listingPriceUsd={listingPriceUsd}
        listingStatus={listingStatus}
        vacationMode={vacationMode}
        canDelete={canDelete}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
