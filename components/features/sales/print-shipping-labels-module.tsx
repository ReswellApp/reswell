"use client"

import { useMemo, useState } from "react"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { PrintShippingLabelPreviewDialog } from "@/components/features/sales/print-shipping-label-preview-dialog"
import { PrintableShippingLabelRow } from "@/components/features/sales/printable-shipping-label-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PrintableShippingLabelSale } from "@/components/features/sales/printable-shipping-label-row"
import { SELLER_PRINT_SHIPPING_LABELS_MAX } from "@/lib/validations/seller-print-shipping-labels"

export type { PrintableShippingLabelSale }

function singleLabelHref(orderId: string): string {
  return `/api/orders/${encodeURIComponent(orderId)}/shipping-label/download?inline=1`
}

function bundleLabelHref(orderIds: string[]): string {
  const first = orderIds[0]
  if (orderIds.length === 1 && first) return singleLabelHref(first)
  return `/api/orders/shipping-labels/bundle?ids=${orderIds.map(encodeURIComponent).join(",")}&inline=1`
}

export function PrintShippingLabelsModule({
  sales,
}: {
  sales: PrintableShippingLabelSale[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewIds, setPreviewIds] = useState<string[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const printableSales = useMemo(() => sales.filter((sale) => sale.hasPrintableLabel), [sales])
  const needsLabelCount = sales.length - printableSales.length
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected = printableSales.length > 0 && selectedIds.length === printableSales.length
  const previewHref = previewIds && previewIds.length > 0 ? bundleLabelHref(previewIds) : null
  const cardCopy =
    printableSales.length > 0 && needsLabelCount > 0
      ? `${printableSales.length} ${printableSales.length === 1 ? "label" : "labels"} ready to print. ${needsLabelCount} still ${needsLabelCount === 1 ? "needs" : "need"} a label.`
      : printableSales.length > 0
        ? "Open shipments with a label ready. Print one, several, or all at once."
        : "These orders still need a shipping label. Buy a label, then print it here."

  function toggleId(orderId: string, next: boolean) {
    setSelectedIds((current) => {
      if (next) return current.includes(orderId) ? current : [...current, orderId]
      return current.filter((id) => id !== orderId)
    })
  }

  function openPreview(orderIds: string[]) {
    if (orderIds.length === 0) {
      toast.error("Select at least one label to print")
      return
    }
    if (orderIds.length > SELLER_PRINT_SHIPPING_LABELS_MAX) {
      toast.error(`You can print up to ${SELLER_PRINT_SHIPPING_LABELS_MAX} labels at a time`)
      return
    }
    setPreviewLoading(true)
    setPreviewIds(orderIds)
  }

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.04]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Print shipping labels</p>
              <Badge variant="secondary" className="tabular-nums font-normal">
                {sales.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{cardCopy}</p>
          </div>
          <Button type="button" className="shrink-0 gap-2" onClick={() => setOpen(true)}>
            <Printer className="h-4 w-4" />
            {printableSales.length > 0 ? "Print shipping labels" : "Get shipping labels"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(92vh,840px)] w-[min(96vw,720px)] max-w-[720px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
            <DialogTitle>Print shipping labels</DialogTitle>
            <DialogDescription>
              Open shipments that still need to go out. Print labels that are ready, or buy a label
              for orders that do not have one yet.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {sales.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No open shipments need a shipping label right now.
              </p>
            ) : (
              <div className="space-y-3">
                {printableSales.length > 0 ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        setSelectedIds(
                          checked === true ? printableSales.map((sale) => sale.orderId) : [],
                        )
                      }}
                      aria-label="Select all printable labels"
                    />
                    Select printable labels ({printableSales.length})
                  </label>
                ) : null}
                <ul className="divide-y divide-border/70 rounded-xl border">
                  {sales.map((sale) => (
                    <PrintableShippingLabelRow
                      key={sale.orderId}
                      sale={sale}
                      checked={selectedSet.has(sale.orderId)}
                      onToggle={(next) => toggleId(sale.orderId, next)}
                      onPrint={() => openPreview([sale.orderId])}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={selectedIds.length === 0}
              onClick={() => openPreview(selectedIds)}
            >
              Print selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={printableSales.length === 0}
              onClick={() => openPreview(printableSales.map((sale) => sale.orderId))}
            >
              <Printer className="h-4 w-4" />
              Print all labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintShippingLabelPreviewDialog
        open={previewIds != null}
        href={previewHref}
        labelCount={previewIds?.length ?? 0}
        loading={previewLoading}
        onOpenChange={(next) => {
          if (!next) {
            setPreviewIds(null)
            setPreviewLoading(false)
          }
        }}
        onLoad={() => setPreviewLoading(false)}
        onError={() => {
          setPreviewLoading(false)
          toast.error("Could not load shipping label")
        }}
      />
    </>
  )
}
