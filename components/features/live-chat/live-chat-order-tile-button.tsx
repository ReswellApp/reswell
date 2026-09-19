"use client"

import Image from "next/image"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"

interface LiveChatOrderTileButtonProps {
  orderNum: string
  title?: string
  imageUrl: string | null
  disabled?: boolean
  onClick: () => void
}

export function LiveChatOrderTileButton({
  orderNum,
  title,
  imageUrl,
  disabled = false,
  onClick,
}: LiveChatOrderTileButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-background px-2 py-1.5 text-left shadow-sm",
        "transition-colors hover:border-listingHeart/40 hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
            unoptimized={listingImageShouldBypassOptimization(imageUrl)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-foreground">#{orderNum}</p>
        {title ? (
          <p className="truncate text-[10px] leading-snug text-muted-foreground">{title}</p>
        ) : null}
      </div>
    </button>
  )
}
