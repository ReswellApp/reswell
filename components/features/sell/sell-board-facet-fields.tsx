"use client"

import { Check } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  type FacetOption,
} from "@/lib/boards-browse-facets"
import { cn } from "@/lib/utils"

export type SellFacetChipGroupProps = {
  label: React.ReactNode
  /** Committed option value; empty string = not specified. */
  value: string
  options: readonly FacetOption[]
  /** Called with "" when the selected chip is tapped again (clears the field). */
  onValueChange: (slug: string) => void
  disabled?: boolean
  className?: string
  size?: "default" | "sm"
}

/**
 * Single-select chip row for sell-form facets: every option is one tap away
 * (no dropdown), and tapping the active chip clears it.
 */
export function SellFacetChipGroup({
  label,
  value,
  options,
  onValueChange,
  disabled,
  className,
  size = "default",
}: SellFacetChipGroupProps) {
  const committed = value.trim()
  const compact = size === "sm"
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = committed === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onValueChange(selected ? "" : opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border font-medium transition-all",
                "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                compact ? "h-8 px-3 text-xs" : "h-10 px-3.5 text-sm",
                selected
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-foreground/20 bg-card text-foreground hover:border-foreground/40 hover:bg-muted/50",
              )}
            >
              {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Two-choice sell control: whether the board comes with fins. */
export const FINS_INCLUDED_OPTIONS: readonly FacetOption[] = [
  { value: "included", label: "Fins included" },
  { value: "not_included", label: "Fins not included" },
]

export type SellBoardFacetFieldsProps = {
  boardFins: string
  boardFinSystem: string
  boardConstruction: string
  boardFinsIncluded: string
  onBoardFinsChange: (value: string) => void
  onBoardFinSystemChange: (value: string) => void
  onBoardConstructionChange: (value: string) => void
  onBoardFinsIncludedChange: (value: string) => void
  disabled?: boolean
}

export function SellBoardFacetFields({
  boardFins,
  boardFinSystem,
  boardConstruction,
  boardFinsIncluded,
  onBoardFinsChange,
  onBoardFinSystemChange,
  onBoardConstructionChange,
  onBoardFinsIncludedChange,
  disabled,
}: SellBoardFacetFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-foreground/80">Fins & construction</p>
        <p className="text-xs text-muted-foreground">
          Optional — helps buyers scan the listing. Tap again to clear.
        </p>
      </div>
      <div className="space-y-3">
        <SellFacetChipGroup
          label="Fin setup"
          value={boardFins}
          options={FIN_SETUP_OPTIONS}
          onValueChange={onBoardFinsChange}
          disabled={disabled}
        />
        <SellFacetChipGroup
          label="Fin system"
          value={boardFinSystem}
          options={FIN_SYSTEM_OPTIONS}
          onValueChange={onBoardFinSystemChange}
          disabled={disabled}
        />
        <SellFacetChipGroup
          label="Fins included"
          value={boardFinsIncluded}
          options={FINS_INCLUDED_OPTIONS}
          onValueChange={onBoardFinsIncludedChange}
          disabled={disabled}
          size="sm"
        />
        <SellFacetChipGroup
          label="Construction"
          value={boardConstruction}
          options={CONSTRUCTION_OPTIONS}
          onValueChange={onBoardConstructionChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
