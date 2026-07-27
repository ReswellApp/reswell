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
  APPAREL_SIZE_OPTIONS,
  type ApparelFacetOption,
} from "@/lib/apparel-listing-config"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"

const UNSELECTED = "__unspecified__"

function SellApparelFacetSelect({
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
  options: readonly ApparelFacetOption[]
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

export type SellApparelFacetFieldsProps = {
  condition: string
  size: string
  brand: string
  model: string
  onConditionChange: (value: string) => void
  onSizeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function SellApparelFacetFields({
  condition,
  size,
  brand,
  model,
  onConditionChange,
  onSizeChange,
  onBrandChange,
  onModelChange,
}: SellApparelFacetFieldsProps) {
  const hasSizeOptions = APPAREL_SIZE_OPTIONS.length > 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SellApparelFacetSelect
          id="sell-apparel-condition"
          label="Condition"
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
          required
        />
        {hasSizeOptions ? (
          <SellApparelFacetSelect
            id="sell-apparel-size"
            label="Size"
            value={size}
            options={APPAREL_SIZE_OPTIONS}
            onValueChange={onSizeChange}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-apparel-brand" className="text-xs font-medium text-foreground/85">
            Brand
          </Label>
          <Input
            id="sell-apparel-brand"
            value={brand}
            placeholder="e.g. Rip Curl, O'Neill, Patagonia"
            className="h-11 border-foreground/20 bg-card text-sm shadow-sm placeholder:text-muted-foreground"
            onChange={(e) => onBrandChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-apparel-model" className="text-xs font-medium text-foreground/85">
            Model
          </Label>
          <Input
            id="sell-apparel-model"
            value={model}
            placeholder="e.g. Flashbomb 3/2, Hyperfreak"
            className="h-11 border-foreground/20 bg-card text-sm shadow-sm placeholder:text-muted-foreground"
            onChange={(e) => onModelChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
