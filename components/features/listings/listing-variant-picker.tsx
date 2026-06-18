"use client"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ListingVariantOption = {
  id: string
  title: string
  option1?: string | null
  option2?: string | null
  option3?: string | null
  price: number | string
  in_stock: boolean
  available: number
}

function variantLabel(v: ListingVariantOption): string {
  const parts = [v.option1, v.option2, v.option3].filter(Boolean)
  if (parts.length > 0) return parts.join(" / ")
  return v.title
}

interface ListingVariantPickerProps {
  variants: ListingVariantOption[]
  value: string | null
  onChange: (variantId: string) => void
  className?: string
}

export function ListingVariantPicker({
  variants,
  value,
  onChange,
  className,
}: ListingVariantPickerProps) {
  const inStock = variants.filter((v) => v.in_stock && v.available > 0)

  if (inStock.length === 0) {
    return <p className="text-sm text-muted-foreground">All options are currently out of stock.</p>
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Select option</Label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose size / option" />
        </SelectTrigger>
        <SelectContent>
          {inStock.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {variantLabel(v)}
              {Number(v.price) > 0 ? ` — $${Number(v.price).toFixed(2)}` : ""}
              {v.available <= 3 ? ` (${v.available} left)` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
