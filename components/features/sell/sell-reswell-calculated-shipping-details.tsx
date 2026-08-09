"use client"

import Link from "next/link"
import { Switch } from "@/components/ui/switch"
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
 * Reverb-style details under “Have Reswell calculate shipping”: origin copy,
 * estimated package data, and UPS label handoff.
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

      <div className="rounded-lg border border-listingHeart/20 bg-listingHeart/[0.06] px-2.5 py-2 sm:rounded-xl sm:px-3.5 sm:py-3">
        <div className="flex items-start gap-2 sm:gap-3">
          <Switch
            checked
            disabled
            aria-label="Use Reswell package data"
            className="mt-0.5 shrink-0 origin-top-left scale-90 data-[state=checked]:bg-listingHeart sm:scale-100"
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-semibold text-foreground sm:text-sm">
              Use Reswell package data
            </p>
            <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
              {packageSummary ? (
                packageSummary
              ) : (
                <>
                  Estimated from board dimensions above
                  <span className="hidden sm:inline">
                    {" "}
                    — no measuring tape needed
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 sm:gap-3">
        <UpsMark className="mt-0.5 scale-90 sm:scale-100" />
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
          <span className="font-semibold text-foreground">Ships with UPS.</span>
          <span className="sm:hidden"> Label emailed when it sells.</span>
          <span className="hidden sm:inline">
            {" "}
            UPS provides strong rates for board packs like this. We&apos;ll email you next
            steps about your label when this listing sells.
          </span>
        </p>
      </div>
    </div>
  )
}
