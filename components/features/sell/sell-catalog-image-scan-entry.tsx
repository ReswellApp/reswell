"use client"

import Link from "next/link"
import { Camera } from "lucide-react"
import { SELL_CATALOG_IMAGE_SCAN_HREF } from "@/lib/types/sell-catalog-image-scan"
import { cn } from "@/lib/utils"

export function SellCatalogImageScanEntry({ className }: { className?: string }) {
  return (
    <Link
      href={SELL_CATALOG_IMAGE_SCAN_HREF}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border border-foreground/15 bg-card px-3.5 text-sm font-medium text-foreground",
        "transition-all hover:border-foreground/40 hover:bg-muted/50 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      <Camera className="h-4 w-4" aria-hidden />
      Scan a photo
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Admin
      </span>
    </Link>
  )
}
