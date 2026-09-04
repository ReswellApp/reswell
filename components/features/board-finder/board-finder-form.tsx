import { Bell, ChevronDown, Loader2 } from "lucide-react"

import { BoardsBrowseCatalogBrandModel } from "@/components/boards-browse-catalog-brand-model"
import { BoardFinderChip } from "@/components/features/board-finder/board-finder-chip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SellBrandModelCatalogRow } from "@/app/actions/marketplace"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  LENGTH_BUCKETS,
  VOLUME_BUCKETS,
} from "@/lib/boards-browse-facets"
import { BOARD_SAVED_SEARCHES_MAX } from "@/lib/validations/boardSavedSearch"
import { cn } from "@/lib/utils"

const ANY = "any"

const fieldLabel = "text-xs font-semibold uppercase tracking-wide text-[#5574AD]"
const selectTrigger =
  "h-11 rounded-full border-border bg-white text-[#001A4A] shadow-sm focus:ring-[#5574AD]/20"
const priceInput =
  "h-11 rounded-full border-border bg-white text-[#001A4A] shadow-sm focus-visible:ring-[#5574AD]/20"

export function BoardFinderForm({
  brand,
  catalogBrandId,
  model,
  style,
  length,
  condition,
  minPrice,
  maxPrice,
  volume,
  construction,
  finSystem,
  showMore,
  emailOptIn,
  pending,
  isSignedIn,
  atSavedLimit,
  canSave,
  onBrandTextChange,
  onCatalogBrandPicked,
  onModelTextChange,
  onCatalogModelPicked,
  onStyleChange,
  onLengthChange,
  onConditionChange,
  onMinPriceChange,
  onMaxPriceChange,
  onVolumeChange,
  onConstructionChange,
  onFinSystemChange,
  onToggleMore,
  onEmailOptInChange,
  onSave,
}: {
  brand: string
  catalogBrandId: string
  model: string
  style: string
  length: string
  condition: string
  minPrice: string
  maxPrice: string
  volume: string
  construction: string
  finSystem: string
  showMore: boolean
  emailOptIn: boolean
  pending: boolean
  isSignedIn: boolean
  atSavedLimit: boolean
  canSave: boolean
  onBrandTextChange: (next: string) => void
  onCatalogBrandPicked: (b: { id: string; name: string; slug: string }) => void
  onModelTextChange: (next: string) => void
  onCatalogModelPicked: (row: SellBrandModelCatalogRow) => void
  onStyleChange: (next: string) => void
  onLengthChange: (next: string) => void
  onConditionChange: (next: string) => void
  onMinPriceChange: (next: string) => void
  onMaxPriceChange: (next: string) => void
  onVolumeChange: (next: string) => void
  onConstructionChange: (next: string) => void
  onFinSystemChange: (next: string) => void
  onToggleMore: () => void
  onEmailOptInChange: (next: boolean) => void
  onSave: () => void
}) {
  return (
    <div className="space-y-6">
      <BoardsBrowseCatalogBrandModel
        brandText={brand}
        catalogBrandId={catalogBrandId}
        modelText={model}
        showLabels
        onBrandTextChange={onBrandTextChange}
        onCatalogBrandPicked={onCatalogBrandPicked}
        onModelTextChange={onModelTextChange}
        onCatalogModelPicked={onCatalogModelPicked}
      />

      <fieldset>
        <legend className={fieldLabel}>Size</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LENGTH_BUCKETS.map((bucket) => (
            <BoardFinderChip
              key={bucket.value}
              selected={length === bucket.value}
              onSelect={() => onLengthChange(length === bucket.value ? ANY : bucket.value)}
            >
              {bucket.label}
            </BoardFinderChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>Style</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BOARD_STYLE_OPTIONS.map((opt) => (
            <BoardFinderChip
              key={opt.value}
              selected={style === opt.value}
              onSelect={() => onStyleChange(style === opt.value ? ANY : opt.value)}
            >
              {opt.label}
            </BoardFinderChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={fieldLabel}>Condition</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CONDITION_OPTIONS.map((opt) => (
            <BoardFinderChip
              key={opt.value}
              selected={condition === opt.value}
              onSelect={() => onConditionChange(condition === opt.value ? ANY : opt.value)}
            >
              {opt.label}
            </BoardFinderChip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="board-finder-min-price" className={fieldLabel}>
            Min price
          </Label>
          <Input
            id="board-finder-min-price"
            inputMode="numeric"
            placeholder="$0"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value.replace(/[^\d]/g, ""))}
            className={priceInput}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="board-finder-max-price" className={fieldLabel}>
            Max price
          </Label>
          <Input
            id="board-finder-max-price"
            inputMode="numeric"
            placeholder="No cap"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value.replace(/[^\d]/g, ""))}
            className={priceInput}
          />
        </div>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#5574AD] hover:text-[#001A4A]"
        onClick={onToggleMore}
      >
        Volume, glass, fins
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
      </button>

      {showMore ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="board-finder-volume" className={fieldLabel}>
              Volume
            </Label>
            <Select value={volume} onValueChange={onVolumeChange}>
              <SelectTrigger id="board-finder-volume" className={selectTrigger}>
                <SelectValue placeholder="Any volume" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any volume</SelectItem>
                {VOLUME_BUCKETS.map((bucket) => (
                  <SelectItem key={bucket.value} value={bucket.value}>
                    {bucket.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board-finder-construction" className={fieldLabel}>
              Construction
            </Label>
            <Select value={construction} onValueChange={onConstructionChange}>
              <SelectTrigger id="board-finder-construction" className={selectTrigger}>
                <SelectValue placeholder="Any construction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any construction</SelectItem>
                {CONSTRUCTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board-finder-fin-system" className={fieldLabel}>
              Fin system
            </Label>
            <Select value={finSystem} onValueChange={onFinSystemChange}>
              <SelectTrigger id="board-finder-fin-system" className={selectTrigger}>
                <SelectValue placeholder="Any fin system" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any fin system</SelectItem>
                {FIN_SYSTEM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl bg-[#F4F7FB] px-4 py-3">
        <Checkbox
          id="board-finder-email"
          checked={emailOptIn}
          onCheckedChange={(v) => onEmailOptInChange(v === true)}
          className="mt-0.5 data-[state=checked]:border-[#001A4A] data-[state=checked]:bg-[#001A4A]"
          disabled={atSavedLimit}
        />
        <div>
          <Label
            htmlFor="board-finder-email"
            className={cn(
              "text-sm font-semibold text-[#001A4A]",
              atSavedLimit ? "cursor-not-allowed text-[#5c6b89]" : "cursor-pointer",
            )}
          >
            Ping me when it lists
          </Label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#5c6b89]">
            Nationwide email to your account. We’ll only write when something matches.
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="h-12 w-full rounded-full bg-[#001A4A] text-base font-semibold text-white hover:bg-[#001A4A]/90"
        disabled={pending || (isSignedIn && atSavedLimit)}
        onClick={onSave}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : !isSignedIn ? (
          "Sign in to start watching"
        ) : atSavedLimit ? (
          `${BOARD_SAVED_SEARCHES_MAX} watches — clear one`
        ) : (
          <>
            <Bell className="mr-2 h-4 w-4" aria-hidden />
            {canSave ? "Watch this board" : "Add a detail first"}
          </>
        )}
      </Button>
    </div>
  )
}
