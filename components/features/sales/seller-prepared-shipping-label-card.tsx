"use client"

import { useState } from "react"
import { Download, ExternalLink, QrCode, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SHIPPING_LABEL_CREATED_STATUS } from "@/lib/sale-card-status"

const USPS_LABEL_BROKER_FINDER =
  "https://tools.usps.com/find-location.htm?locationType=po&serviceType=lbroretail"

export function SellerPreparedShippingLabelCard({
  orderId,
  downloadApiPrefix = "/api/orders",
  hasPaperlessQr = false,
  paperlessInstructions = null,
  paperlessHandoffCode = null,
}: {
  orderId: string
  /** API prefix before `/:orderId/shipping-label/download` — use `/api/admin/orders` on admin pages. */
  downloadApiPrefix?: string
  /** USPS Label Broker QR available for phone drop-off. */
  hasPaperlessQr?: boolean
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
}) {
  const [pdfOpen, setPdfOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const encodedId = encodeURIComponent(orderId)
  const viewHref = `${downloadApiPrefix}/${encodedId}/shipping-label/download?inline=1`
  const downloadHref = `${downloadApiPrefix}/${encodedId}/shipping-label/download`
  const qrHref = `${downloadApiPrefix}/${encodedId}/shipping-label/qr`

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            {SHIPPING_LABEL_CREATED_STATUS}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {hasPaperlessQr
              ? "Show this QR code at a participating USPS Post Office — they will print and apply the label. Tap the code to open it fullscreen. You can also print the PDF yourself."
              : "Reswell purchased this carrier label for the sale. View or download the PDF, print it, and attach it to your package before handing it to the carrier."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPaperlessQr ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-2 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open USPS QR code fullscreen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated binary QR from our API */}
                <img
                  src={qrHref}
                  alt="USPS Label Broker QR code for this shipment"
                  className="h-auto w-full max-w-[200px] object-contain"
                />
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
                  <QrCode className="h-3.5 w-3.5" />
                  Tap to open fullscreen for USPS
                </span>
              </button>
              {paperlessHandoffCode ? (
                <p className="text-center text-sm text-muted-foreground">
                  Handoff code:{" "}
                  <span className="font-mono font-semibold tracking-wide text-foreground">
                    {paperlessHandoffCode}
                  </span>
                </p>
              ) : null}
              {paperlessInstructions ? (
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  {paperlessInstructions}
                </p>
              ) : null}
              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                Find a participating Post Office:{" "}
                <a
                  href={USPS_LABEL_BROKER_FINDER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  USPS Label Broker locations
                </a>
                .
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {hasPaperlessQr ? (
              <Button
                size="sm"
                className="gap-2"
                type="button"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="h-4 w-4" />
                Show USPS QR code
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              type="button"
              onClick={() => setPdfOpen(true)}
            >
              <ExternalLink className="h-4 w-4" />
              View label PDF
            </Button>
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <a href={downloadHref} download>
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] max-h-[min(92vh,900px)] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>Shipping label</DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the carrier shipping label PDF for this sale.
            </DialogDescription>
          </DialogHeader>
          <iframe
            src={viewHref}
            title="Shipping label PDF"
            className="min-h-0 flex-1 w-full border-0 bg-muted"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="flex h-[min(96vh,960px)] max-h-[min(96vh,960px)] w-[min(96vw,560px)] max-w-[560px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>USPS drop-off QR code</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Show this screen at a participating USPS retail counter. The clerk will scan the code,
              print the label, and apply it for you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-white px-6 py-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated binary QR from our API */}
            <img
              src={qrHref}
              alt="USPS Label Broker QR code for this shipment"
              className="h-auto w-full max-w-[320px] object-contain"
            />
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
    </>
  )
}
