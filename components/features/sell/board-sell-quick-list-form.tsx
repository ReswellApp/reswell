"use client"

import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { QuickEssentialCard } from "@/components/features/sell/quick/quick-essential-card"
import { QuickPublishBar } from "@/components/features/sell/quick/quick-publish-bar"
import { SellFacetChipGroup } from "@/components/features/sell/sell-board-facet-fields"
import { SELL_CONTROL_CLASS } from "@/components/features/sell/sell-form-surface"
import { SellListingDescriptionField } from "@/components/features/sell/sell-listing-description-field"
import { LISTING_CONDITION_SELL_OPTIONS } from "@/lib/listing-labels"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { cn } from "@/lib/utils"

type BoardSellQuickListFormProps = {
  photoHero: ReactNode
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  price: string
  onPriceChange: (value: string) => void
  priceValid: boolean
  condition: string
  onConditionChange: (value: string) => void
  conditionComplete: boolean
  locationPicker: ReactNode
  locationSet: boolean
  missing: string[]
  uploadingPhotos: boolean
  publishing: boolean
  validationBanner: string | null
  toolbar: ReactNode
}

export function BoardSellQuickListForm({
  photoHero,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  price,
  onPriceChange,
  priceValid,
  condition,
  onConditionChange,
  conditionComplete,
  locationPicker,
  locationSet,
  missing,
  uploadingPhotos,
  publishing,
  validationBanner,
  toolbar,
}: BoardSellQuickListFormProps) {
  return (
    <div className="space-y-4 sm:space-y-5">
      {photoHero}

      <QuickEssentialCard
        title="Title"
        complete={Boolean(title.trim()) && title.trim().length <= LISTING_TITLE_MAX_LENGTH}
      >
        <div className="space-y-2">
          <div className="flex justify-end">
            <span
              className={cn(
                "text-xs tabular-nums",
                title.length > LISTING_TITLE_MAX_LENGTH
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {title.length}/{LISTING_TITLE_MAX_LENGTH}
            </span>
          </div>
          <Input
            id="quick-listing-title"
            className={SELL_CONTROL_CLASS}
            placeholder={`e.g., 6'0 CI Rookie`}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            autoComplete="off"
            maxLength={LISTING_TITLE_MAX_LENGTH}
            aria-label="Listing title"
          />
        </div>
      </QuickEssentialCard>

      <QuickEssentialCard title="Description" complete={Boolean(description.trim())}>
        <SellListingDescriptionField
          id="quick-listing-description"
          value={description}
          onChange={onDescriptionChange}
          placeholder="Condition, wear, why you're selling…"
          maxLength={1000}
        />
      </QuickEssentialCard>

      <QuickEssentialCard title="Price" complete={priceValid}>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            id="quick-listing-price"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-label="Listing price in dollars"
            className={cn(SELL_CONTROL_CLASS, "pl-7 text-base")}
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
          />
        </div>
      </QuickEssentialCard>

      <QuickEssentialCard title="Condition" complete={conditionComplete}>
        <SellFacetChipGroup
          label={<span className="sr-only">Condition</span>}
          value={condition}
          options={LISTING_CONDITION_SELL_OPTIONS}
          onValueChange={onConditionChange}
        />
      </QuickEssentialCard>

      <QuickEssentialCard
        title="Location"
        hint="City + state for local pickup."
        complete={locationSet}
      >
        {locationPicker}
      </QuickEssentialCard>

      <QuickPublishBar
        missing={missing}
        uploadingPhotos={uploadingPhotos}
        publishing={publishing}
      />

      {validationBanner ? (
        <div
          id="quick-publish-validation-banner"
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {validationBanner}
        </div>
      ) : null}

      {toolbar}
    </div>
  )
}
