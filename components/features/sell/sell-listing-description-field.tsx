"use client"

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
}: SellListingDescriptionFieldProps) {
  const showCounter = maxLength != null && maxLength > 0
  const nearLimit = showCounter && value.length > maxLength * 0.9

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        Description
        {required ? (
          <>
            {" "}
            <SellRequiredMark complete={value.trim().length > 0} />
          </>
        ) : null}
      </Label>
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
