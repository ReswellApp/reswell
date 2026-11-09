"use client"

import Image from "next/image"
import Link from "next/link"
import { Printer, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { sellerOpenShipmentLabelStatus } from "@/lib/shipping/seller-shipping-label-qr"
import { listingPortraitThumbClass, listingPortraitThumbSizes } from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export type PrintableShippingLabelSale = {
  orderId: string
  orderNum: string
  title: string
  imageUrl: string | null
  buyerName: string
  hasPrintableLabel: boolean
  hasPaperlessQr: boolean
  paperlessInstructions: string | null
  paperlessHandoffCode: string | null
}

export function PrintableShippingLabelRow({
  sale,
  checked,
  onToggle,
  onPrint,
  onShowQr,
}: {
  sale: PrintableShippingLabelSale
  checked: boolean
  onToggle: (next: boolean) => void
  onPrint: () => void
  onShowQr: () => void
}) {
  const ready = sale.hasPrintableLabel || sale.hasPaperlessQr

  return (
    <li>
      <div className={cn("flex items-center gap-3 px-3 py-3", checked && "bg-primary/[0.04]")}>
        {sale.hasPrintableLabel ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onToggle(value === true)}
            aria-label={`Select ${sale.title}`}
          />
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={listingPortraitThumbClass}>
            {sale.imageUrl ? (
              <Image
                src={sale.imageUrl}
                alt=""
                fill
                className={listingPhotoFillClassName}
                sizes={listingPortraitThumbSizes}
                unoptimized={listingImageShouldBypassOptimization(sale.imageUrl)}
              />
            ) : (
              <div className="h-full w-full bg-muted" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{sale.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              Sale #{sale.orderNum} · {sale.buyerName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sellerOpenShipmentLabelStatus(sale)}
            </p>
          </div>
        </div>
        {ready ? (
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
            {sale.hasPaperlessQr ? (
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={onShowQr}
                aria-label={`Show USPS QR code for ${sale.title}`}
              >
                <QrCode className="h-3.5 w-3.5" />
                Show QR
              </Button>
            ) : null}
            {sale.hasPrintableLabel ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={onPrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Print label
              </Button>
            ) : null}
          </div>
        ) : (
          <Button size="sm" className="shrink-0" asChild>
            <Link href={`/shipping?order=${encodeURIComponent(sale.orderId)}`}>Buy label</Link>
          </Button>
        )}
      </div>
    </li>
  )
}
