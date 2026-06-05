"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
  type FinFacetOption,
} from "@/lib/fin-listing-config"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"

const UNSELECTED = "__unspecified__"

function SellFinFacetSelect({
  id,
  label,
  hint,
  value,
  options,
  onValueChange,
  required,
}: {
  id: string
  label: string
  hint?: string
  value: string
  options: readonly FinFacetOption[]
  onValueChange: (slug: string) => void
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground/45">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      <Select
        value={value.trim() ? value : UNSELECTED}
        onValueChange={(next) => onValueChange(next === UNSELECTED ? "" : next)}
      >
        <SelectTrigger id={id} className="h-10 text-sm">
          <SelectValue placeholder={required ? "Select…" : "Not specified"} />
        </SelectTrigger>
        <SelectContent>
          {!required ? <SelectItem value={UNSELECTED}>Not specified</SelectItem> : null}
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground/45">{hint}</p> : null}
    </div>
  )
}

export type SellFinsFacetFieldsProps = {
  condition: string
  finSetup: string
  finSystem: string
  size: string
  brand: string
  model: string
  onConditionChange: (value: string) => void
  onFinSetupChange: (value: string) => void
  onFinSystemChange: (value: string) => void
  onSizeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function SellFinsFacetFields({
  condition,
  finSetup,
  finSystem,
  size,
  brand,
  model,
  onConditionChange,
  onFinSetupChange,
  onFinSystemChange,
  onSizeChange,
  onBrandChange,
  onModelChange,
}: SellFinsFacetFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SellFinFacetSelect
          id="sell-fin-condition"
          label="Condition"
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
          required
        />
        <SellFinFacetSelect
          id="sell-fin-setup"
          label="Fin setup"
          hint="Thruster, quad, twin, single, etc."
          value={finSetup}
          options={FIN_SETUP_OPTIONS}
          onValueChange={onFinSetupChange}
        />
        <SellFinFacetSelect
          id="sell-fin-system"
          label="Fin system"
          hint="Futures, FCS II, glass-on, etc."
          value={finSystem}
          options={FIN_SYSTEM_OPTIONS_FOR_FINS}
          onValueChange={onFinSystemChange}
        />
        <SellFinFacetSelect
          id="sell-fin-size"
          label="Size"
          value={size}
          options={FIN_SIZE_OPTIONS}
          onValueChange={onSizeChange}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-fin-brand" className="text-xs text-muted-foreground/45">
            Brand
          </Label>
          <Input
            id="sell-fin-brand"
            value={brand}
            placeholder="e.g. FCS, Futures, Captain Fin"
            className="h-10 text-sm placeholder:text-muted-foreground/45"
            onChange={(e) => onBrandChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-fin-model" className="text-xs text-muted-foreground/45">
            Model
          </Label>
          <Input
            id="sell-fin-model"
            value={model}
            placeholder="e.g. Performer, Mark Richards"
            className="h-10 text-sm placeholder:text-muted-foreground/45"
            onChange={(e) => onModelChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
