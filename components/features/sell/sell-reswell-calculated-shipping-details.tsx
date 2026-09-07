"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { UpsMark } from "@/components/features/sell/carrier-mark-icons"
import { cn } from "@/lib/utils"

export type SellReswellCalculatedShippingDetailsProps = {
  originCity?: string
  originState?: string
  packageLengthIn?: string
  packageWidthIn?: string
  packageHeightIn?: string
  packageWeightLb?: string
  packageWeightOz?: string
  className?: string
  /** Packed size/weight fields shown under the Reswell option (e.g. fins). */
  packageSlot?: ReactNode
}

function formatOriginLabel(city?: string, state?: string): string | null {
  const c = city?.trim() ?? ""
  const s = state?.trim() ?? ""
  if (!c && !s) return null
  return [c, s].filter(Boolean).join(", ")
}

function formatPackageSummary(input: {
  lengthIn?: string
  widthIn?: string
  heightIn?: string
  weightLb?: string
  weightOz?: string
}): string | null {
  const lengthIn = input.lengthIn?.trim() ?? ""
  const widthIn = input.widthIn?.trim() ?? ""
  const heightIn = input.heightIn?.trim() ?? ""
  const weightLb = input.weightLb?.trim() ?? ""
  if (!lengthIn || !widthIn || !heightIn || !weightLb) return null
  const ozRaw = input.weightOz?.trim() ?? ""
  const oz = ozRaw && Number.isFinite(Number(ozRaw)) ? ozRaw : "0"
  return `${lengthIn}×${widthIn}×${heightIn} in · ${weightLb} lb ${oz} oz`
}

/**
 * Details under “Have Reswell calculate shipping”: origin copy, packed-size
 * fields or a package summary, and UPS label handoff.
 */
export function SellReswellCalculatedShippingDetails({
  originCity,
  originState,
  packageLengthIn,
  packageWidthIn,
  packageHeightIn,
  packageWeightLb,
  packageWeightOz,
  className,
  packageSlot,
}: SellReswellCalculatedShippingDetailsProps) {
  const origin = formatOriginLabel(originCity, originState)
  const packageSummary = formatPackageSummary({
    lengthIn: packageLengthIn,
    widthIn: packageWidthIn,
    heightIn: packageHeightIn,
    weightLb: packageWeightLb,
    weightOz: packageWeightOz,
  })

  return (
    <div className={cn("space-y-2.5 sm:space-y-3.5", className)}>
      <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
        We&apos;ll calculate shipping
        {origin ? (
          <>
            {" "}
            from you{" "}
            <span className="font-semibold text-foreground">({origin})</span>
          </>
        ) : null}{" "}
        to the buyer. They pay at checkout; we email you the label.{" "}
        <Link
          href="/terms"
          className="font-medium text-foreground underline underline-offset-2 hover:text-listingHeart"
          onClick={(e) => e.stopPropagation()}
        >
          View terms
        </Link>
      </p>

      {packageSlot ? (
        <div className="pt-0.5">{packageSlot}</div>
      ) : packageSummary ? (
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
          <span className="font-semibold text-foreground">Package </span>
          {packageSummary}
        </p>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
          Enter the outer box you&apos;ll ship in so buyers see an accurate rate.
        </p>
      )}

      <div className="flex items-start gap-2 sm:gap-3">
        <UpsMark className="mt-0.5 scale-90 sm:scale-100" />
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
          <span className="font-semibold text-foreground">Ships with UPS.</span>
          <span className="sm:hidden"> Label emailed when it sells.</span>
          <span className="hidden sm:inline">
            {" "}
            We&apos;ll email you next steps about your label when this listing sells.
          </span>
        </p>
      </div>
    </div>
  )
}
