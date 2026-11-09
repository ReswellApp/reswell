"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { USPS_LABEL_BROKER_FINDER } from "@/lib/shipping/seller-shipping-label-qr"

export function SellerShippingLabelQrDialog({
  open,
  onOpenChange,
  qrHref,
  title = "USPS drop-off QR code",
  description = "Show this screen at a participating USPS retail counter. The clerk will scan the code, print the label, and apply it for you.",
  alt = "USPS Label Broker QR code for this shipment",
  paperlessInstructions = null,
  paperlessHandoffCode = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrHref: string | null
  title?: string
  description?: string
  alt?: string
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(96vh,960px)] max-h-[min(96vh,960px)] w-[min(96vw,560px)] max-w-[560px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-white px-6 py-8">
          {qrHref ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated binary QR from our API
            <img src={qrHref} alt={alt} className="h-auto w-full max-w-[320px] object-contain" />
          ) : null}
          {paperlessHandoffCode ? (
            <p className="text-center text-sm text-neutral-700">
              Handoff code:{" "}
              <span className="font-mono font-semibold tracking-wide">{paperlessHandoffCode}</span>
            </p>
          ) : null}
          {paperlessInstructions ? (
            <p className="max-w-sm text-center text-xs leading-relaxed text-neutral-600">
              {paperlessInstructions}
            </p>
          ) : null}
          <a
            href={USPS_LABEL_BROKER_FINDER}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-600 underline underline-offset-2"
          >
            Find participating USPS locations
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
