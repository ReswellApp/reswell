"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  type FacetOption,
} from "@/lib/boards-browse-facets"

const UNSELECTED = "__unspecified__"

type SellOptionalFacetSelectProps = {
  id: string
  label: string
  hint?: string
  value: string
  options: readonly FacetOption[]
  onValueChange: (slug: string) => void
  disabled?: boolean
}

function SellOptionalFacetSelect({
  id,
  label,
  hint,
  value,
  options,
  onValueChange,
  disabled,
}: SellOptionalFacetSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/85">
        {label}
      </Label>
      <Select
        value={value.trim() ? value : UNSELECTED}
        onValueChange={(next) => onValueChange(next === UNSELECTED ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-11 border-foreground/20 bg-card text-sm shadow-sm">
          <SelectValue placeholder="Not specified" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSELECTED}>Not specified</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
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
          Optional — helps surfers filter and compare your board on browse.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SellOptionalFacetSelect
          id="sell-fin-setup"
          label="Fin setup"
          hint="How many fins the board is set up for (thruster, quad, etc.)."
          value={boardFins}
          options={FIN_SETUP_OPTIONS}
          onValueChange={onBoardFinsChange}
          disabled={disabled}
        />
        <SellOptionalFacetSelect
          id="sell-fin-system"
          label="Fin system"
          hint="Plug or box type (Futures, FCS, glass-on, etc.)."
          value={boardFinSystem}
          options={FIN_SYSTEM_OPTIONS}
          onValueChange={onBoardFinSystemChange}
          disabled={disabled}
        />
        <SellOptionalFacetSelect
          id="sell-construction"
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
