"use client"

import { useState } from "react"
import { Download, ExternalLink, QrCode, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const USPS_LABEL_BROKER_FINDER =
  "https://tools.usps.com/find-location.htm?locationType=po&serviceType=lbroretail"

/**
 * Prepaid return label + paperless QR for an authorized item return.
 * Paths: `{apiPrefix}/{orderId}/returns/{returnId}/shipping-label/{download|qr}`
 */
export function OrderReturnLabelCard({
  orderId,
  returnId,
  apiPrefix = "/api/orders",
  hasPaperlessQr = false,
  paperlessInstructions = null,
  paperlessHandoffCode = null,
  audience = "buyer",
}: {
  orderId: string
  returnId: string
  apiPrefix?: "/api/orders" | "/api/admin/orders"
  hasPaperlessQr?: boolean
  paperlessInstructions?: string | null
  paperlessHandoffCode?: string | null
  audience?: "buyer" | "seller" | "admin"
}) {
  const [pdfOpen, setPdfOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const base = `${apiPrefix}/${encodeURIComponent(orderId)}/returns/${encodeURIComponent(returnId)}/shipping-label`
  const viewHref = `${base}/download?inline=1`
  const downloadHref = `${base}/download`
  const qrHref = `${base}/qr`

  const description =
    audience === "buyer"
      ? hasPaperlessQr
        ? "Show this QR at a participating USPS Post Office to drop off your return, or print the PDF and attach it to the package."
        : "Print this prepaid return label and attach it to your package before dropping it off with the carrier."
      : audience === "seller"
        ? "The buyer was issued this prepaid return label. Track the inbound return below — earnings for this item reverse after return delivery settles (~24h)."
        : "Return label issued to the buyer for this item."

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-amber-800 dark:text-amber-200" />
            Return shipping label
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPaperlessQr && audience !== "seller" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-2 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open return USPS QR code fullscreen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated binary QR from our API */}
                <img
                  src={qrHref}
                  alt="USPS Label Broker QR code for this return shipment"
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
            {hasPaperlessQr && audience !== "seller" ? (
              <Button size="sm" className="gap-2" type="button" onClick={() => setQrOpen(true)}>
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
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Return shipping label</DialogTitle>
            <DialogDescription>Prepaid return label PDF.</DialogDescription>
          </DialogHeader>
          <iframe title="Return shipping label PDF" src={viewHref} className="min-h-0 flex-1 w-full rounded-md border" />
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return USPS QR code</DialogTitle>
            <DialogDescription>Show this fullscreen at a participating Post Office.</DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrHref} alt="Return USPS Label Broker QR" className="mx-auto w-full max-w-[280px]" />
        </DialogContent>
      </Dialog>
    </>
  )
}
