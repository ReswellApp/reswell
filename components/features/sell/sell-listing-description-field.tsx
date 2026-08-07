"use client"

import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SELL_TEXTAREA_CLASS } from "@/components/features/sell/sell-form-surface"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import { cn } from "@/lib/utils"

/** Shown under every peer listing description field — freeform; no minimum length enforced. */
export const SELL_LISTING_DESCRIPTION_HINT =
  "Write 2–3 sentences in your own words—condition, any wear or repairs, and why you're selling. Helps more buyers find your listing."

export type SellListingDescriptionFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  required?: boolean
  className?: string
  /** When set, shows a "Write it for me" AI button next to the label. */
  onGenerate?: () => void
  generating?: boolean
}

export function SellListingDescriptionField({
  id,
  value,
  onChange,
  placeholder = "Describe your item…",
  maxLength,
  rows = 5,
  required = true,
  className,
  onGenerate,
  generating = false,
}: SellListingDescriptionFieldProps) {
  const showCounter = maxLength != null && maxLength > 0
  const nearLimit = showCounter && value.length > maxLength * 0.9

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id}>
          Description
          {required ? (
            <>
              {" "}
              <SellRequiredMark complete={value.trim().length > 0} />
            </>
          ) : null}
        </Label>
        {onGenerate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium text-listingHeart hover:bg-listingHeart/10 hover:text-listingHeart"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {generating ? "Writing…" : value.trim() ? "Rewrite it for me" : "Write it for me"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{SELL_LISTING_DESCRIPTION_HINT}</p>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          SELL_TEXTAREA_CLASS,
          showCounter && "min-h-[120px] resize-none",
        )}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {showCounter ? (
        <span
          className={cn(
            "text-xs tabular-nums",
            nearLimit ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {value.length} / {maxLength}
        </span>
      ) : null}
    </div>
  )
}
