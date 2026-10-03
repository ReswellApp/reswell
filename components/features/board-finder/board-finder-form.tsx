import { ChevronDown, Loader2 } from "lucide-react"

import { BoardsBrowseCatalogBrandModel } from "@/components/boards-browse-catalog-brand-model"
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

const fieldLabel = "text-[13px] font-medium tracking-tight text-[#13233f]"
const selectTrigger =
  "h-12 rounded-2xl border-[#d5dee8] bg-[#f7f9fb] text-[15px] text-[#13233f] shadow-none focus:ring-[#3d6b86]/25"
const priceInput =
  "h-12 rounded-2xl border-[#d5dee8] bg-[#f7f9fb] text-[15px] text-[#13233f] shadow-none placeholder:text-[#8b9aab]"

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
    <div className="space-y-7">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#3d6b86]">
          What to watch
        </p>
        <div className="mt-4 [&_input]:h-12 [&_input]:rounded-2xl [&_input]:border-[#d5dee8] [&_input]:bg-[#f7f9fb] [&_input]:shadow-none [&_label]:text-[13px] [&_label]:font-medium [&_label]:tracking-tight [&_label]:text-[#13233f]">
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="board-finder-length" className={fieldLabel}>
            Size
          </Label>
          <Select value={length} onValueChange={onLengthChange}>
            <SelectTrigger id="board-finder-length" className={selectTrigger}>
              <SelectValue placeholder="Any size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any size</SelectItem>
              {LENGTH_BUCKETS.map((bucket) => (
                <SelectItem key={bucket.value} value={bucket.value}>
                  {bucket.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="board-finder-style" className={fieldLabel}>
            Style
          </Label>
          <Select value={style} onValueChange={onStyleChange}>
            <SelectTrigger id="board-finder-style" className={selectTrigger}>
              <SelectValue placeholder="Any style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any style</SelectItem>
              {BOARD_STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="board-finder-condition" className={fieldLabel}>
            Condition
          </Label>
          <Select value={condition} onValueChange={onConditionChange}>
            <SelectTrigger id="board-finder-condition" className={selectTrigger}>
              <SelectValue placeholder="Any condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any condition</SelectItem>
              {CONDITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
            placeholder="No max"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value.replace(/[^\d]/g, ""))}
            className={priceInput}
          />
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center gap-3 text-left text-sm text-[#5c6d80] hover:text-[#13233f]"
        onClick={onToggleMore}
        aria-expanded={showMore}
      >
        <span>Volume, construction, fins</span>
        <span className="h-px flex-1 bg-[#e3eaef]" aria-hidden />
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

      <div className="flex items-start gap-3 rounded-2xl bg-[#f4f7fa] px-4 py-3.5">
        <Checkbox
          id="board-finder-email"
          checked={emailOptIn}
          onCheckedChange={(v) => onEmailOptInChange(v === true)}
          className="mt-0.5 data-[state=checked]:border-[#13233f] data-[state=checked]:bg-[#13233f]"
          disabled={atSavedLimit}
        />
        <Label
          htmlFor="board-finder-email"
          className={cn(
            "text-sm leading-snug text-[#13233f]",
            atSavedLimit ? "cursor-not-allowed text-[#7d8c9b]" : "cursor-pointer",
          )}
        >
          Email me when a match lists
        </Label>
      </div>

      <Button
        type="button"
        className={cn(
          "h-12 w-full rounded-full text-[15px] font-medium tracking-tight shadow-none",
          canSave
            ? "bg-[#13233f] text-white hover:bg-[#1c3358]"
            : "bg-[#e7eef3] text-[#13233f] hover:bg-[#dce6ee]",
        )}
        disabled={pending || (isSignedIn && atSavedLimit)}
        onClick={onSave}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : !isSignedIn ? (
          "Sign in to save"
        ) : atSavedLimit ? (
          `${BOARD_SAVED_SEARCHES_MAX} searches — remove one`
        ) : canSave ? (
          "Save alert"
        ) : (
          "Add a filter first"
        )}
      </Button>
    </div>
  )
}
