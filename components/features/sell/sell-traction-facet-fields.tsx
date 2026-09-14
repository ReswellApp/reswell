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
  TRACTION_SIZE_OPTIONS,
  type TractionFacetOption,
} from "@/lib/traction-listing-config"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"

const UNSELECTED = "__unspecified__"

function SellTractionFacetSelect({
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
  options: readonly TractionFacetOption[]
  onValueChange: (slug: string) => void
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/85">
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
        <SelectTrigger id={id} className="h-11 border-foreground/20 bg-card text-sm shadow-sm">
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
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export type SellTractionFacetFieldsProps = {
  condition: string
  size: string
  brand: string
  model: string
  onConditionChange: (value: string) => void
  onSizeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function SellTractionFacetFields({
  condition,
  size,
  brand,
  model,
  onConditionChange,
  onSizeChange,
  onBrandChange,
  onModelChange,
}: SellTractionFacetFieldsProps) {
  const hasSizeOptions = TRACTION_SIZE_OPTIONS.length > 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SellTractionFacetSelect
          id="sell-traction-condition"
          label="Condition"
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
          required
        />
        {hasSizeOptions ? (
          <SellTractionFacetSelect
            id="sell-traction-size"
            label="Type"
            value={size}
            options={TRACTION_SIZE_OPTIONS}
            onValueChange={onSizeChange}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-traction-brand" className="text-xs font-medium text-foreground/85">
            Brand
          </Label>
          <Input
            id="sell-traction-brand"
            value={brand}
            placeholder="e.g. Creatures, Dakine, FCS"
            className="h-11 border-foreground/20 bg-card text-sm shadow-sm placeholder:text-muted-foreground"
            onChange={(e) => onBrandChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-traction-model" className="text-xs font-medium text-foreground/85">
            Model
          </Label>
          <Input
            id="sell-traction-model"
            value={model}
            placeholder="e.g. Icon II, Superlite"
            className="h-11 border-foreground/20 bg-card text-sm shadow-sm placeholder:text-muted-foreground"
            onChange={(e) => onModelChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
