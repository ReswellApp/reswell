"use client"

import { useState } from "react"
import { Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AdminShippingLabelPreviewButtonProps {
  orderId: string
  className?: string
}

export function AdminShippingLabelPreviewButton({
  orderId,
  className,
}: AdminShippingLabelPreviewButtonProps) {
  const [open, setOpen] = useState(false)
  const encodedId = encodeURIComponent(orderId)
  const viewHref = `/api/admin/orders/${encodedId}/shipping-label/download?inline=1`
  const downloadHref = `/api/admin/orders/${encodedId}/shipping-label/download`

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setOpen(true)}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          View label
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] max-h-[min(92vh,900px)] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>Shipping label</DialogTitle>
            <DialogDescription>
              Carrier label PDF for this order. Compare the printed FROM address with the seller’s
              ship-from on file.
            </DialogDescription>
          </DialogHeader>
          <iframe
            src={viewHref}
            title="Shipping label PDF"
            className="min-h-0 flex-1 w-full border-0 bg-muted"
          />
          <div className="shrink-0 border-t px-6 py-3">
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={downloadHref} download>
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Download PDF
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
