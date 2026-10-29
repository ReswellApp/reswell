"use client"

import { useState } from "react"
import { QrCode } from "lucide-react"
import { SellerShippingLabelQrDialog } from "@/components/features/sales/seller-shipping-label-qr-dialog"
import { Button, type ButtonProps } from "@/components/ui/button"
import { sellerShippingLabelQrHref } from "@/lib/shipping/seller-shipping-label-qr"

export function ShowShippingLabelQrButton({
  orderId,
  labelId = null,
  downloadApiPrefix = "/api/orders",
  paperlessInstructions = null,
  paperlessHandoffCode = null,
  variant = "default",
  size = "sm",
  className,
  label = "Show QR",
}: {
  orderId: string
  labelId?: string | null
  downloadApiPrefix?: string
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const qrHref = sellerShippingLabelQrHref({ orderId, labelId, downloadApiPrefix })

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Show USPS QR code"
      >
        <QrCode className="h-3.5 w-3.5" />
        {label}
      </Button>
      <SellerShippingLabelQrDialog
        open={open}
        onOpenChange={setOpen}
        qrHref={qrHref}
        paperlessInstructions={paperlessInstructions}
        paperlessHandoffCode={paperlessHandoffCode}
      />
    </>
  )
}
