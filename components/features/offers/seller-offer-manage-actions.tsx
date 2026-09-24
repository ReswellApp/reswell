"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SellerMakeOfferToBuyerDialog } from "@/components/features/messages/seller-make-offer-to-buyer-dialog"
import { revokeSellerOfferAction } from "@/lib/actions/revokeSellerOffer"
import { cn } from "@/lib/utils"

export function SellerOfferManageActions({
  offerId,
  listingId,
  buyerUserId,
  sellerUserId,
  listingTitle,
  listPrice,
  onCompleted,
  compact = false,
  className,
}: {
  offerId: string
  listingId: string
  buyerUserId: string
  sellerUserId: string
  listingTitle: string
  listPrice: number
  onCompleted?: () => void | Promise<void>
  compact?: boolean
  className?: string
}) {
  const [revoking, setRevoking] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const buttonClass = compact
    ? "h-7 rounded-md px-2.5 text-[11px] font-medium"
    : "h-10 rounded-xl text-[14px] font-semibold"

  return (
    <div className={cn(compact ? "flex flex-wrap gap-1.5" : "grid grid-cols-2 gap-2", className)}>
      <Button
        type="button"
        size="sm"
        className={buttonClass}
        onClick={() => setUpdateOpen(true)}
      >
        Update offer
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          buttonClass,
          "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
        disabled={revoking}
        onClick={() => {
          void (async () => {
            setRevoking(true)
            try {
              const result = await revokeSellerOfferAction({ offerId })
              if ("error" in result && result.error) {
                toast.error(result.error)
                return
              }
              toast.success("Offer revoked.")
              await onCompleted?.()
            } finally {
              setRevoking(false)
            }
          })()
        }}
      >
        {revoking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Revoke offer"}
      </Button>

      <SellerMakeOfferToBuyerDialog
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        listingId={listingId}
        buyerUserId={buyerUserId}
        sellerUserId={sellerUserId}
        listingTitle={listingTitle}
        listPrice={listPrice > 0 ? listPrice : undefined}
        onOfferSent={() => {
          void onCompleted?.()
        }}
      />
    </div>
  )
}
