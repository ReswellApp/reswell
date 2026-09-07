"use client"

import { Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function PrintShippingLabelPreviewDialog({
  open,
  href,
  labelCount,
  loading,
  onOpenChange,
  onLoad,
  onError,
}: {
  open: boolean
  href: string | null
  labelCount: number
  loading: boolean
  onOpenChange: (open: boolean) => void
  onLoad: () => void
  onError: () => void
}) {
  const multiple = labelCount > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,900px)] max-h-[min(92vh,900px)] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>
            {multiple ? `Print ${labelCount} shipping labels` : "Print shipping label"}
          </DialogTitle>
          <DialogDescription>
            Use your browser print dialog to send the label{multiple ? "s" : ""} to your printer.
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 bg-muted">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {href ? (
            <iframe
              src={href}
              title="Shipping label PDF"
              className="h-full w-full border-0"
              onLoad={onLoad}
              onError={onError}
            />
          ) : null}
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-3">
          <Button
            type="button"
            className="gap-2"
            disabled={!href}
            onClick={() => {
              if (!href) return
              window.open(href, "_blank", "noopener,noreferrer")
            }}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
