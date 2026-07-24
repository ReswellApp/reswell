"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  SurfboardShippingEstimator,
  type SurfboardShippingEstimatorListingContext,
} from "@/components/features/sell/surfboard-shipping-estimator"

export function SurfboardShippingEstimatorDialog({
  open,
  onOpenChange,
  boardLength,
  boardWidthInches,
  boardThicknessInches,
  boardVolumeL,
  locationLat: _locationLat,
  locationLng: _locationLng,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  /** Reserved for future “use listing location” flows */
  locationLat: number
  /** Reserved for future “use listing location” flows */
  locationLng: number
}) {
  void _locationLat
  void _locationLng

  const listingContext: SurfboardShippingEstimatorListingContext = {
    boardLength,
    boardWidthInches,
    boardThicknessInches,
    boardVolumeL,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,900px)] max-w-[min(100vw-1.5rem,28rem)] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-none sm:max-w-md"
      >
        <DialogHeader className="shrink-0 space-y-0 border-0 px-10 pb-1 pt-8 text-center sm:px-14">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            Live shipping quote
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter your ship-from ZIP, buyer ZIP, package weight, and dimensions to see what buyers
            typically pay for that lane at checkout.
          </DialogDescription>
        </DialogHeader>

        <SurfboardShippingEstimator
          idPrefix="sell-est"
          open={open}
          listingContext={listingContext}
          className="flex min-h-0 flex-1 flex-col"
        />
      </DialogContent>
    </Dialog>
  )
}
