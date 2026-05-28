"use client"

import { useState } from "react"
import { Download, ExternalLink, Truck } from "lucide-react"
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

export function SellerPreparedShippingLabelCard({ orderId }: { orderId: string }) {
  const [pdfOpen, setPdfOpen] = useState(false)

  const viewHref = `/api/orders/${encodeURIComponent(orderId)}/shipping-label/download?inline=1`
  const downloadHref = `/api/orders/${encodeURIComponent(orderId)}/shipping-label/download`

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            {SHIPPING_LABEL_CREATED_STATUS}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Reswell purchased this carrier label for the sale. View or download the PDF, print it,
            and attach it to your package before handing it to the carrier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
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
    </>
  )
}
