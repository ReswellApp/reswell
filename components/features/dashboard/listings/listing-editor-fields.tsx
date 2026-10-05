"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ChoiceChip } from "@/components/features/dashboard/listings/choice-chip"
import {
  LISTING_CONDITION_SELL_OPTIONS,
  formatCondition,
} from "@/lib/listing-labels"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import {
  isShopPackageSizeId,
  shopPackageChipLabel,
  shopPackageSizeSummary,
  shopPackageSizesForSection,
} from "@/lib/shop-category-package-sizes"
import { LISTING_QUICK_EDIT_DESCRIPTION_MAX } from "@/lib/validations/listing-quick-edit"
import { cn } from "@/lib/utils"

const quietControlClass =
  "rounded-xl border-border/70 bg-background shadow-none ring-offset-0 transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0"

interface DraftPatch {
  title?: string
  description?: string
  condition?: string
  priceInput?: string
  packageSizeId?: string
}

interface ListingEditorDetailsProps {
  listingId: string
  section: string
  description: string
  condition: string
  packageSizeId: string
  disabled: boolean
  onChange: (patch: DraftPatch) => void
}

export function DeskTitleInput({
  id,
  value,
  disabled,
  onChange,
  className,
}: {
  id: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Input
      id={id}
      value={value}
      maxLength={LISTING_TITLE_MAX_LENGTH}
      disabled={disabled}
      autoComplete="off"
      aria-label="Title"
      placeholder="Untitled listing"
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-auto min-h-10 border-transparent bg-transparent px-2 py-1 text-[16px] font-semibold tracking-tight text-foreground shadow-none ring-offset-0",
        "placeholder:font-medium hover:bg-muted/70 focus-visible:border-transparent focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 md:text-[16px]",
        className,
      )}
    />
  )
}

export function DeskPriceInput({
  id,
  value,
  disabled,
  onChange,
  className,
}: {
  id: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-[7.25rem] shrink-0 items-center rounded-xl border border-transparent bg-transparent px-2 transition-colors",
        "hover:bg-muted/70 focus-within:bg-muted/60 focus-within:ring-2 focus-within:ring-foreground/10",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-label="Price in dollars"
        placeholder="0"
        onChange={(event) => onChange(event.target.value)}
        className="h-10 border-0 bg-transparent px-1.5 shadow-none ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums md:text-sm"
      />
    </div>
  )
}

export function ListingEditorDetails({
  listingId,
  section,
  description,
  condition,
  packageSizeId,
  disabled,
  onChange,
}: ListingEditorDetailsProps) {
  const packageSizes = isPeerListingSection(section) ? shopPackageSizesForSection(section) : []
  const packageSummary =
    packageSizeId === "custom"
      ? "Custom box. Dimensions stay as they are until you pick a size."
      : isShopPackageSizeId(packageSizeId)
        ? shopPackageSizeSummary(packageSizeId)
        : "No size yet"
  const conditionLabel = formatCondition(condition)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">Condition</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Condition">
          {LISTING_CONDITION_SELL_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.value}
              selected={condition === option.value}
              disabled={disabled}
              onClick={() => onChange({ condition: option.value })}
            >
              {option.label}
            </ChoiceChip>
          ))}
        </div>
        {condition && !LISTING_CONDITION_SELL_OPTIONS.some((option) => option.value === condition) ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Current: {conditionLabel}</p>
        ) : null}
      </div>
      {packageSizes.length > 0 ? (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Package size</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Package size">
            {packageSizeId === "custom" ? (
              <ChoiceChip selected className="pointer-events-none">
                Custom
              </ChoiceChip>
            ) : null}
            {packageSizes.map((sizeId) => (
              <ChoiceChip
                key={sizeId}
                selected={packageSizeId === sizeId}
                disabled={disabled}
                onClick={() => onChange({ packageSizeId: sizeId })}
              >
                {shopPackageChipLabel(sizeId)}
              </ChoiceChip>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{packageSummary}</p>
        </div>
      ) : null}
      <div>
        <label htmlFor={`${listingId}-description`} className="text-[12px] font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          id={`${listingId}-description`}
          value={description}
          maxLength={LISTING_QUICK_EDIT_DESCRIPTION_MAX}
          rows={4}
          disabled={disabled}
          placeholder="Condition, dimensions, what’s included."
          onChange={(event) => onChange({ description: event.target.value })}
          className={cn(quietControlClass, "mt-2 min-h-[7.5rem] resize-y px-3 py-2.5 text-[15px] leading-relaxed md:text-[15px]")}
        />
      </div>
    </div>
  )
}
