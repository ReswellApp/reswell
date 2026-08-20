"use client"

import { CheckCircle2 } from "lucide-react"
import { ReswellPlatformStarBox } from "@/components/features/reswell/reswell-platform-star-boxes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  SALE_TIP_MAX_USD_LABEL,
  SALE_TIP_MIN_CENTS,
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
  type SaleTipPresetPercent,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

const CHANNELS = Object.keys(SOLD_OFF_PLATFORM_CHANNEL_LABELS) as SoldOffPlatformChannel[]

export function formatTipCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export function MarkSoldSurveyForm({
  soldChannel,
  elsewhereDetail,
  elsewhereDetailValid,
  helpedOffPlatform,
  listingPriceUsd,
  presets,
  selectedTipCents,
  customTip,
  customTipCents,
  rating,
  review,
  loading,
  onChannelChange,
  onDetailChange,
  onHelpedOffPlatformChange,
  onSelectNoTip,
  onSelectPreset,
  onCustomTipChange,
  onRatingChange,
  onReviewChange,
  onSubmit,
}: {
  soldChannel: SoldOffPlatformChannel | null
  elsewhereDetail: string
  elsewhereDetailValid: boolean
  helpedOffPlatform: boolean
  listingPriceUsd: number | null
  presets: { percent: SaleTipPresetPercent; cents: number }[]
  selectedTipCents: number | null
  customTip: string
  customTipCents: number | null
  rating: number | null
  review: string
  loading: boolean
  onChannelChange: (channel: SoldOffPlatformChannel) => void
  onDetailChange: (value: string) => void
  onHelpedOffPlatformChange: (value: boolean) => void
  onSelectNoTip: () => void
  onSelectPreset: (cents: number) => void
  onCustomTipChange: (value: string) => void
  onRatingChange: (value: number) => void
  onReviewChange: (value: string) => void
  onSubmit: () => void
}) {
  const customTipInvalid = customTip.trim().length > 0 && customTipCents === null
  const canSubmit =
    Boolean(soldChannel) && elsewhereDetailValid && !customTipInvalid && !loading
  const listingPriceLabel =
    listingPriceUsd != null && listingPriceUsd > 0
      ? formatTipCents(Math.round(listingPriceUsd * 100))
      : null
  const noTipSelected = selectedTipCents === null && !customTip.trim()

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Where did you sell it?</h3>
        <div className="flex flex-col gap-2">
          {CHANNELS.map((channel) => (
            <Button
              key={channel}
              type="button"
              size="sm"
              variant={soldChannel === channel ? "default" : "outline"}
              className="h-9 justify-start"
              disabled={loading}
              onClick={() => onChannelChange(channel)}
            >
              {SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]}
            </Button>
          ))}
        </div>
        {soldChannel === "elsewhere" ? (
          <Input
            value={elsewhereDetail}
            onChange={(event) => onDetailChange(event.target.value)}
            placeholder="Where did you sell it?"
            maxLength={200}
            disabled={loading}
            aria-invalid={!elsewhereDetailValid}
          />
        ) : null}
        {soldChannel && soldChannel !== "reswell" ? (
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="reswell-helped-find-buyer"
              checked={helpedOffPlatform}
              disabled={loading}
              onCheckedChange={(checked) => onHelpedOffPlatformChange(checked === true)}
            />
            <Label
              htmlFor="reswell-helped-find-buyer"
              className="text-sm font-normal leading-snug text-muted-foreground"
            >
              Listing or chatting on Reswell helped
            </Label>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Optional tip</h3>
        <p className="text-xs text-muted-foreground">
          {listingPriceLabel
            ? `Percents are based on your ${listingPriceLabel} listing price.`
            : "Completely up to you."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={noTipSelected ? "default" : "outline"}
            disabled={loading}
            onClick={onSelectNoTip}
          >
            No tip
          </Button>
          {presets.map((preset) => (
            <Button
              key={preset.percent}
              type="button"
              size="sm"
              variant={
                !customTip.trim() && selectedTipCents === preset.cents ? "default" : "outline"
              }
              disabled={loading}
              onClick={() => onSelectPreset(preset.cents)}
            >
              {preset.percent}% · {formatTipCents(preset.cents)}
            </Button>
          ))}
        </div>
        <Input
          value={customTip}
          onChange={(event) => onCustomTipChange(event.target.value)}
          placeholder="Custom amount"
          inputMode="decimal"
          disabled={loading}
          aria-label="Custom tip amount"
        />
        {customTipInvalid ? (
          <p className="text-xs text-destructive">
            Enter an amount between {formatTipCents(SALE_TIP_MIN_CENTS)} and {SALE_TIP_MAX_USD_LABEL}.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Rate Reswell</h3>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={loading}
              onClick={() => onRatingChange(value)}
              className="rounded-sm transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              aria-label={`Rate ${value} out of 5 stars`}
              aria-pressed={rating === value}
            >
              <ReswellPlatformStarBox
                fill={rating != null && value <= rating ? 1 : 0}
                size="md"
                starClassName="fill-yellow-400 text-yellow-400"
              />
            </button>
          ))}
        </div>
        {rating != null ? (
          <Textarea
            value={review}
            onChange={(event) => onReviewChange(event.target.value)}
            disabled={loading}
            rows={3}
            maxLength={2000}
            placeholder="Optional — what went well?"
            aria-label="Review of Reswell"
            className="min-h-[72px] resize-y"
          />
        ) : null}
      </section>

      <Button type="button" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
        {loading ? "Saving…" : selectedTipCents != null ? "Continue to tip" : "Done"}
      </Button>
    </div>
  )
}

export function MarkSoldThanksStep({
  onClose,
  tipped,
}: {
  onClose: () => void
  tipped?: boolean
}) {
  return (
    <div className="space-y-4 py-2 text-center sm:text-left">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 sm:mx-0" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Thank you</h3>
        <p className="text-sm text-muted-foreground">
          {tipped
            ? "Your tip and feedback help keep Reswell going for surfers."
            : "Your feedback helps keep Reswell honest and useful for surfers."}
        </p>
      </div>
      <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
