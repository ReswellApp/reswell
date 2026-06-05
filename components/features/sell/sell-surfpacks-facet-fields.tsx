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
  SURFPACK_SIZE_OPTIONS,
  type SurfpackFacetOption,
} from "@/lib/surfpack-listing-config"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"

const UNSELECTED = "__unspecified__"

function SellSurfpackFacetSelect({
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
  options: readonly SurfpackFacetOption[]
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

export type SellSurfpacksFacetFieldsProps = {
  condition: string
  size: string
  brand: string
  model: string
  onConditionChange: (value: string) => void
  onSizeChange: (value: string) => void
  onBrandChange: (value: string) => void
  onModelChange: (value: string) => void
}

export function SellSurfpacksFacetFields({
  condition,
  size,
  brand,
  model,
  onConditionChange,
  onSizeChange,
  onBrandChange,
  onModelChange,
}: SellSurfpacksFacetFieldsProps) {
  const hasSizeOptions = SURFPACK_SIZE_OPTIONS.length > 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SellSurfpackFacetSelect
          id="sell-surfpack-condition"
          label="Condition"
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
          required
        />
        {hasSizeOptions ? (
          <SellSurfpackFacetSelect
            id="sell-surfpack-size"
            label="Size"
            value={size}
            options={SURFPACK_SIZE_OPTIONS}
            onValueChange={onSizeChange}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sell-surfpack-brand" className="text-xs text-muted-foreground/45">
            Brand
          </Label>
          <Input
            id="sell-surfpack-brand"
            value={brand}
            placeholder="e.g. Rip Curl, O'Neill, Patagonia"
            className="h-10 text-sm placeholder:text-muted-foreground/45"
            onChange={(e) => onBrandChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sell-surfpack-model" className="text-xs text-muted-foreground/45">
            Model
          </Label>
          <Input
            id="sell-surfpack-model"
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
