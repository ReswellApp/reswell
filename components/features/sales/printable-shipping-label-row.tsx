"use client"

import Image from "next/image"
import Link from "next/link"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { listingPortraitThumbClass, listingPortraitThumbSizes } from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

export type PrintableShippingLabelSale = {
  orderId: string
  orderNum: string
  title: string
  imageUrl: string | null
  buyerName: string
  hasPrintableLabel: boolean
}

export function PrintableShippingLabelRow({
  sale,
  checked,
  onToggle,
  onPrint,
}: {
  sale: PrintableShippingLabelSale
  checked: boolean
  onToggle: (next: boolean) => void
  onPrint: () => void
}) {
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
                className="object-cover"
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
              {sale.hasPrintableLabel ? "Label ready to print" : "Needs a shipping label"}
            </p>
          </div>
        </div>
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
        ) : (
          <Button size="sm" className="shrink-0" asChild>
            <Link href={`/shipping?order=${encodeURIComponent(sale.orderId)}`}>Buy label</Link>
          </Button>
        )}
      </div>
    </li>
  )
}
