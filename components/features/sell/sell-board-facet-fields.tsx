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
}: SellFacetChipGroupProps) {
  const committed = value.trim()
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/85">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
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
                "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-all",
                "active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-foreground/20 bg-card text-foreground hover:border-foreground/40 hover:bg-muted/50",
              )}
            >
              {selected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type SellBoardFacetFieldsProps = {
  boardFins: string
  boardFinSystem: string
  boardConstruction: string
  onBoardFinsChange: (value: string) => void
  onBoardFinSystemChange: (value: string) => void
  onBoardConstructionChange: (value: string) => void
  disabled?: boolean
}

export function SellBoardFacetFields({
  boardFins,
  boardFinSystem,
  boardConstruction,
  onBoardFinsChange,
  onBoardFinSystemChange,
  onBoardConstructionChange,
  disabled,
}: SellBoardFacetFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-foreground/80">Fin setup & construction</p>
        <p className="text-xs text-muted-foreground">
          Optional — helps surfers filter and compare your board on browse. Tap again to clear.
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
