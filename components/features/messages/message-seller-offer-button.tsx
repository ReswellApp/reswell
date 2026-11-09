"use client"

import { Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SellerMakeOfferToBuyerDialog } from "@/components/features/messages/seller-make-offer-to-buyer-dialog"
import { useState } from "react"

export function MessageSellerOfferButton({
  conversationId,
  listingId,
  buyerUserId,
  sellerUserId,
  listingTitle,
  listPrice,
  primaryImageUrl,
  disabled,
  onOfferSent,
}: {
  conversationId: string
  listingId: string
  buyerUserId: string
  sellerUserId: string
  listingTitle: string
  listPrice: number
  primaryImageUrl: string | null
  disabled?: boolean
  onOfferSent?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-8 w-8 shrink-0 rounded-full bg-[#E9E9EB] text-foreground shadow-none hover:bg-[#dedee0] dark:bg-[#3A3A3C] dark:hover:bg-[#4a4a4c]"
        aria-label="Make an offer"
        onClick={() => setOpen(true)}
      >
        <Tag className="h-5 w-5" strokeWidth={2} aria-hidden />
      </Button>

      <SellerMakeOfferToBuyerDialog
        open={open}
        onOpenChange={setOpen}
        listingId={listingId}
        buyerUserId={buyerUserId}
        sellerUserId={sellerUserId}
        conversationId={conversationId}
        listingTitle={listingTitle}
        listPrice={listPrice}
        primaryImageUrl={primaryImageUrl}
        onOfferSent={() => {
          void onOfferSent?.()
        }}
      />
    </>
  )
}
