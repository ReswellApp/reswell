"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatUsd } from "@/lib/utils/format-usd"
import { sellPriceGuidanceToInputValue } from "@/lib/sell-price-guidance-format"
import type { SellPriceGuidance, SellPriceGuidanceTier } from "@/lib/types/sell-price-guidance"
import type { SellPriceGuidanceCategorySlug } from "@/lib/validations/sell-price-guidance"

export type SellPriceGuidancePickerProps = {
  categorySlug: SellPriceGuidanceCategorySlug
  brandId: string | null | undefined
  brandModelId: string | null | undefined
  condition: string | null | undefined
  listingPrice: string
  onSelectPrice: (value: string) => void
  className?: string
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; guidance: SellPriceGuidance }
  | { status: "empty" }
  | { status: "error" }

const TIER_COPY: Record<
  SellPriceGuidanceTier,
  { label: string; hint: string; emphasize?: boolean }
> = {
  low: { label: "Lowest", hint: "Move faster" },
  mid: { label: "Best price", hint: "Recommended", emphasize: true },
  high: { label: "Highest", hint: "Max ask" },
}

function tierUsd(guidance: SellPriceGuidance, tier: SellPriceGuidanceTier): number {
  if (tier === "low") return guidance.range.low_usd
  if (tier === "high") return guidance.range.high_usd
  return guidance.range.mid_usd
}

export function SellPriceGuidancePicker({
  categorySlug,
  brandId,
  brandModelId,
  condition,
  listingPrice,
  onSelectPrice,
  className,
}: SellPriceGuidancePickerProps) {
  const headingId = useId()
  const [state, setState] = useState<LoadState>({ status: "idle" })

  const brand = brandId?.trim() || ""
  const model = brandModelId?.trim() || ""
  const conditionKey = condition?.trim() || ""

  useEffect(() => {
    if (!brand || !model) {
      setState({ status: "idle" })
      return
    }

    const controller = new AbortController()
    setState({ status: "loading" })

    const params = new URLSearchParams({
      category_slug: categorySlug,
      brand_id: brand,
      brand_model_id: model,
    })
    if (conditionKey) params.set("condition", conditionKey)

    void (async () => {
      try {
        const res = await fetch(`/api/sell/price-guidance?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        })
        if (!res.ok) {
          if (!controller.signal.aborted) setState({ status: "error" })
          return
        }
        const json: unknown = await res.json()
        const guidance =
          json &&
          typeof json === "object" &&
          "data" in json &&
          json.data &&
          typeof json.data === "object" &&
          "guidance" in json.data
            ? (json.data as { guidance: SellPriceGuidance | null }).guidance
            : null

        if (controller.signal.aborted) return
        if (!guidance?.range) {
          setState({ status: "empty" })
          return
        }
        setState({ status: "ready", guidance })
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" })
      }
    })()

    return () => controller.abort()
  }, [categorySlug, brand, model, conditionKey])

  if (!brand || !model) return null
  if (state.status === "idle") return null
  if (state.status === "empty" || state.status === "error") return null

  if (state.status === "loading") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/80 bg-slate-50/80 px-3 py-3 text-sm text-muted-foreground",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking Reswell pricing for this model…
      </div>
    )
  }

  const { guidance } = state
  const selectedRaw = listingPrice.trim().replace(/[$,\s]/g, "")
  const selectedNum = selectedRaw ? Number(selectedRaw) : NaN

  return (
    <div
      className={cn("space-y-3 rounded-xl border border-border bg-slate-50/70 p-3 sm:p-4", className)}
      role="group"
      aria-labelledby={headingId}
    >
      <div className="space-y-1">
        <p id={headingId} className="text-sm font-semibold text-foreground">
          Suggested listing price
          {guidance.condition_label ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {guidance.condition_label}
            </span>
          ) : null}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{guidance.summary}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["low", "mid", "high"] as const).map((tier) => {
          const usd = tierUsd(guidance, tier)
          const copy = TIER_COPY[tier]
          const isSelected =
            Number.isFinite(selectedNum) && Math.round(selectedNum) === Math.round(usd)
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onSelectPrice(sellPriceGuidanceToInputValue(usd))}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2",
                copy.emphasize
                  ? "border-listingHeart/40 bg-white shadow-sm"
                  : "border-border bg-white/80 hover:bg-white",
                isSelected && "border-listingHeart bg-listingHeart/5 ring-1 ring-listingHeart/30",
              )}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "text-[11px] font-medium uppercase tracking-wide",
                  copy.emphasize ? "text-listingHeart" : "text-muted-foreground",
                )}
              >
                {copy.label}
              </span>
              <span className="text-base font-semibold tabular-nums text-foreground sm:text-lg">
                {formatUsd(usd).replace(/\.00$/, "")}
              </span>
              <span className="text-[11px] text-muted-foreground">{copy.hint}</span>
            </button>
          )
        })}
      </div>

      {guidance.guide_href ? (
        <p className="text-xs text-muted-foreground">
          <Link
            href={guidance.guide_href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            View full price guide
          </Link>
        </p>
      ) : null}
    </div>
  )
}
