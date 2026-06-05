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
  WETSUIT_SIZE_OPTIONS,
  type WetsuitFacetOption,
} from "@/lib/wetsuit-listing-config"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"

const UNSELECTED = "__unspecified__"

function SellWetsuitFacetSelect({
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
  options: readonly WetsuitFacetOption[]
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

export type SellWetsuitsFacetFieldsProps = {
  condition: string
  size: string
  brand: string
  model: string
  onConditionChange: (value: string) => void
  onSizeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function SellWetsuitsFacetFields({
  condition,
  size,
  brand,
  model,
  onConditionChange,
  onSizeChange,
  onBrandChange,
  onModelChange,
}: SellWetsuitsFacetFieldsProps) {
  const hasSizeOptions = WETSUIT_SIZE_OPTIONS.length > 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SellWetsuitFacetSelect
          id="sell-wetsuit-condition"
          label="Condition"
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
          required
        />
        {hasSizeOptions ? (
          <SellWetsuitFacetSelect
            id="sell-wetsuit-size"
            label="Size"
            value={size}
            options={WETSUIT_SIZE_OPTIONS}
            onValueChange={onSizeChange}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-wetsuit-brand" className="text-xs text-muted-foreground/45">
            Brand
          </Label>
          <Input
            id="sell-wetsuit-brand"
            value={brand}
            placeholder="e.g. Rip Curl, O'Neill, Patagonia"
            className="h-10 text-sm placeholder:text-muted-foreground/45"
            onChange={(e) => onBrandChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-wetsuit-model" className="text-xs text-muted-foreground/45">
            Model
          </Label>
          <Input
            id="sell-wetsuit-model"
            value={model}
            placeholder="e.g. Flashbomb 3/2, Hyperfreak"
            className="h-10 text-sm placeholder:text-muted-foreground/45"
            onChange={(e) => onModelChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
