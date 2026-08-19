"use client"

import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { ReswellPlatformStarBox } from "@/components/features/reswell/reswell-platform-star-boxes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
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

export function SurveyStepDots({ current, total }: { current: number; total: number }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {current} of {total}
    </p>
  )
}

export function SurveyStepNav({
  onBack,
  onContinue,
  backDisabled,
  continueDisabled,
  continueLabel = "Continue",
}: {
  onBack?: () => void
  onContinue: () => void
  backDisabled?: boolean
  continueDisabled?: boolean
  continueLabel?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <Button
          type="button"
          variant="outline"
          disabled={backDisabled}
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" disabled={continueDisabled} onClick={onContinue}>
        {continueLabel}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}

export function MarkSoldChannelStep({
  soldChannel,
  elsewhereDetail,
  elsewhereDetailValid,
  loading,
  onChannelChange,
  onDetailChange,
  onContinue,
}: {
  soldChannel: SoldOffPlatformChannel | null
  elsewhereDetail: string
  elsewhereDetailValid: boolean
  loading: boolean
  onChannelChange: (channel: SoldOffPlatformChannel) => void
  onDetailChange: (value: string) => void
  onContinue: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={1} total={4} />
        <h3 className="text-lg font-semibold">Where did you sell it?</h3>
        <p className="text-sm text-muted-foreground">
          This helps us understand how sellers close deals.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {CHANNELS.map((channel) => (
          <Button
            key={channel}
            type="button"
            variant={soldChannel === channel ? "default" : "outline"}
            className="justify-start"
            onClick={() => onChannelChange(channel)}
          >
            {SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]}
          </Button>
        ))}
        {soldChannel === "elsewhere" ? (
          <Input
            value={elsewhereDetail}
            onChange={(e) => onDetailChange(e.target.value)}
            placeholder="Where did you sell it?"
            maxLength={200}
            disabled={loading}
            aria-invalid={!elsewhereDetailValid}
          />
        ) : null}
      </div>
      <SurveyStepNav
        onContinue={onContinue}
        continueDisabled={!soldChannel || !elsewhereDetailValid || loading}
        continueLabel={loading ? "Saving…" : "Continue"}
      />
    </div>
  )
}

export function MarkSoldHelpedStep({
  selected,
  loading,
  onHelpedChange,
  onBack,
  onContinue,
  stepTotal = 4,
}: {
  selected: boolean | null
  loading: boolean
  onHelpedChange: (value: boolean) => void
  onBack: () => void
  onContinue: () => void
  stepTotal?: number
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={2} total={stepTotal} />
        <h3 className="text-lg font-semibold">Did Reswell help you find a buyer?</h3>
        <p className="text-sm text-muted-foreground">
          Even if you closed the sale elsewhere, listing here or chatting on Reswell counts.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={selected === true ? "default" : "outline"}
          className="justify-start"
          disabled={loading}
          onClick={() => onHelpedChange(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={selected === false ? "default" : "outline"}
          className={cn("justify-start", selected === false && "border-transparent")}
          disabled={loading}
          onClick={() => onHelpedChange(false)}
        >
          No
        </Button>
      </div>
      <SurveyStepNav
        onBack={onBack}
        onContinue={onContinue}
        backDisabled={loading}
        continueDisabled={selected === null || loading}
        continueLabel={loading ? "Saving…" : "Continue"}
      />
    </div>
  )
}

export function MarkSoldTipAmountStep({
  reswellHelped,
  listingPriceUsd,
  presets,
  customTip,
  customTipCents,
  loading,
  onCustomTipChange,
  onSelectPreset,
  onSubmitCustom,
  onBack,
  onNoThanks,
}: {
  reswellHelped: boolean | null
  listingPriceUsd: number | null
  presets: { percent: SaleTipPresetPercent; cents: number }[]
  customTip: string
  customTipCents: number | null
  loading: boolean
  onCustomTipChange: (value: string) => void
  onSelectPreset: (cents: number) => void
  onSubmitCustom: () => void
  onBack: () => void
  onNoThanks: () => void
}) {
  const listingPriceLabel =
    listingPriceUsd != null && listingPriceUsd > 0
      ? formatTipCents(Math.round(listingPriceUsd * 100))
      : null

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={3} total={4} />
        <h3 className="text-lg font-semibold">Leave a tip? It&apos;s optional</h3>
        <p className="text-sm text-muted-foreground">
          {reswellHelped
            ? "If Reswell helped you connect with a buyer, you can leave a tip. Completely up to you."
            : "Want to support Reswell? You can leave an optional tip. Completely up to you."}
        </p>
        {listingPriceLabel ? (
          <p className="text-sm text-muted-foreground">
            Percentages are based on your {listingPriceLabel} listing price.
          </p>
        ) : null}
      </div>
      {presets.length > 0 ? (
        <div className="flex flex-col gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.percent}
              type="button"
              variant="outline"
              className="justify-between"
              disabled={loading}
              onClick={() => onSelectPreset(preset.cents)}
            >
              <span>{preset.percent}% of listing price</span>
              <span className="tabular-nums">{formatTipCents(preset.cents)}</span>
            </Button>
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-medium">Custom tip</p>
        <Input
          value={customTip}
          onChange={(e) => onCustomTipChange(e.target.value)}
          placeholder="Custom amount"
          inputMode="decimal"
          disabled={loading}
          aria-label="Custom tip amount"
        />
      </div>
      {customTip.trim() && customTipCents === null ? (
        <p className="text-sm text-destructive">
          Enter an amount between {formatTipCents(SALE_TIP_MIN_CENTS)} and {SALE_TIP_MAX_USD_LABEL}.
        </p>
      ) : null}
      <SurveyStepNav
        onBack={onBack}
        onContinue={customTipCents !== null ? onSubmitCustom : onNoThanks}
        backDisabled={loading}
        continueDisabled={loading}
        continueLabel={loading ? "Saving…" : "Continue"}
      />
    </div>
  )
}

export function MarkSoldReviewStep({
  rating,
  review,
  loading,
  onRatingChange,
  onReviewChange,
  onBack,
  onContinue,
  stepCurrent = 4,
  stepTotal = 4,
}: {
  rating: number | null
  review: string
  loading: boolean
  onRatingChange: (value: number) => void
  onReviewChange: (value: string) => void
  onBack: () => void
  onContinue: () => void
  stepCurrent?: number
  stepTotal?: number
}) {
  const reviewReady = review.trim().length >= 10

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={stepCurrent} total={stepTotal} />
        <h3 className="text-lg font-semibold">Rate Reswell</h3>
        <p className="text-sm text-muted-foreground">
          Honest feedback from surfers helps us get better. Choose 1 to 5 stars and tell us what you
          think.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
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
              size="lg"
              starClassName="fill-yellow-400 text-yellow-400"
            />
          </button>
        ))}
      </div>
      <Textarea
        value={review}
        onChange={(event) => onReviewChange(event.target.value)}
        disabled={loading}
        rows={5}
        maxLength={2000}
        placeholder="What went well? What could be better? Be honest."
        aria-label="Review of Reswell"
        className="min-h-[120px] resize-y"
      />
      {review.trim() && !reviewReady ? (
        <p className="text-sm text-destructive">Share a bit more so other surfers get the picture.</p>
      ) : null}
      <SurveyStepNav
        onBack={onBack}
        onContinue={onContinue}
        backDisabled={loading}
        continueDisabled={rating == null || !reviewReady || loading}
        continueLabel={loading ? "Saving…" : "Submit review"}
      />
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
