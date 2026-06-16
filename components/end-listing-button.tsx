"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { EndListingDialog } from "@/components/end-listing-dialog"

interface EndListingButtonProps {
  listingId: string
  /** Applied to the primary trigger button only (dialog buttons unchanged). */
  triggerClassName?: string
}

export function EndListingButton({ listingId, triggerClassName }: EndListingButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        End listing
      </Button>
      <EndListingDialog listingId={listingId} open={open} onOpenChange={setOpen} />
    </>
  )
}
