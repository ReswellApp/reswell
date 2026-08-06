"use client"

import { PencilRuler } from "lucide-react"

import { Label } from "@/components/ui/label"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SurfboardStockSizeOption } from "@/lib/types/board-stock-sizes"
import { cn } from "@/lib/utils"

export type SellBoardStockSizePickerProps = {
  /** Catalog model the sizes belong to — shown in the helper copy. */
  modelName: string | null
  sizes: SurfboardStockSizeOption[]
  selectedId: string | null
  /** "custom" keeps the dropdown mounted with the Custom option selected. */
  mode: "stock" | "custom"
  onSelectSize: (size: SurfboardStockSizeOption) => void
  onChooseCustom: () => void
  required?: boolean
  /** When required: the dimensions the picker fills are all validly set. */
  complete?: boolean
  disabled?: boolean
}

/** Radix Select value for the custom-dimensions option — must not collide with a variant UUID. */
const CUSTOM_SIZE_VALUE = "__custom_dimensions__"

/**
 * Shared by the column header and every row so the four columns always line
 * up. Column widths are fixed (not fr units): Radix's ItemText span
 * shrink-wraps its content, so fractional columns would collapse to each
 * row's own content width and the columns would drift between rows.
 */
const SIZE_GRID_CLASS =
  "grid grid-cols-[3.5rem_5.5rem_5rem_auto] items-baseline justify-items-start gap-x-2 tabular-nums sm:gap-x-3"

/**
 * Stock-size dropdown shown above the manual dimension selects when the linked
 * catalog model has variants: choosing a size fills length/width/thickness/
 * volume (same formData fields as the manual picker — no separate storage),
 * and "Custom size" reveals the regular dimension inputs below.
 */
export function SellBoardStockSizePicker({
  modelName,
  sizes,
  selectedId,
  mode,
  onSelectSize,
  onChooseCustom,
  required,
  complete,
  disabled,
}: SellBoardStockSizePickerProps) {
  const value = mode === "custom" ? CUSTOM_SIZE_VALUE : selectedId ?? ""

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/85">
        Dimensions
        {required ? (
          <>
            {" "}
            <SellRequiredMark complete={Boolean(complete)} />
          </>
        ) : null}
      </Label>
      <p className="text-xs text-muted-foreground">
        {modelName ? `Stock sizes for the ${modelName}` : "Stock sizes for this model"} — pick
        yours to fill the dimensions, or choose a custom size.
      </p>
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          if (next === CUSTOM_SIZE_VALUE) {
            onChooseCustom()
            return
          }
          const size = sizes.find((s) => s.id === next)
          if (size) onSelectSize(size)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          className="h-14 w-full text-sm sm:max-w-md"
          aria-label="Board dimensions"
        >
          <SelectValue placeholder="Choose your size" />
        </SelectTrigger>
        {/* side + no collision flip: always opens downward; the viewport's
            available-height cap makes it shrink and scroll instead of flipping up. */}
        <SelectContent side="bottom" avoidCollisions={false} className="max-h-[min(60vh,24rem)]">
          <div
            className={cn(
              SIZE_GRID_CLASS,
              "py-1.5 pl-8 pr-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <span>Length</span>
            <span>Width</span>
            <span>Thick</span>
            <span>Vol</span>
          </div>
          {sizes.map((size) => (
            <SelectItem key={size.id} value={size.id} className="py-3">
              <span className={SIZE_GRID_CLASS}>
                <span className="text-base font-bold text-foreground">
                  {size.lengthLabel}
                </span>
                <span className="text-sm font-medium">{size.widthLabel || "—"}</span>
                <span className="text-sm font-medium">{size.thicknessLabel || "—"}</span>
                <span className="text-sm font-medium">{size.volumeLabel || "—"}</span>
              </span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM_SIZE_VALUE} className="py-2.5">
            <span className="flex items-center gap-1.5">
              <PencilRuler
                className={cn("h-3.5 w-3.5 text-muted-foreground")}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">Custom size</span>
              <span className="text-xs text-muted-foreground">— enter your own dimensions</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
