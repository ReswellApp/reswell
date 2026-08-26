"use client"

import type { ReactNode } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { ReswellPlatformStarBox } from "@/components/features/reswell/reswell-platform-star-boxes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  SALE_TIP_MAX_USD_LABEL,
  SALE_TIP_MIN_CENTS,
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
  type SaleTipPresetPercent,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

const CHANNELS = Object.keys(SOLD_OFF_PLATFORM_CHANNEL_LABELS) as SoldOffPlatformChannel[]

const CHANNEL_SHORT_LABELS: Record<SoldOffPlatformChannel, string> = {
  reswell: "Reswell",
  fb_marketplace: "Facebook",
  craigslist: "Craigslist",
  elsewhere: "Somewhere else",
}

export function formatTipCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export function MarkSoldTipCheckoutPlaceholder() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-3">
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Opening card payment…
      </p>
    </div>
  )
}

export function MarkSoldSurveyForm({
  soldChannel,
  elsewhereDetail,
  elsewhereDetailValid,
  helpedOffPlatform,
  presets,
  selectedTipCents,
  customTip,
  customTipCents,
  rating,
  loading,
  tipCheckout,
  onChannelChange,
  onDetailChange,
  onHelpedOffPlatformChange,
  onSelectNoTip,
  onSelectPreset,
  onCustomTipChange,
  onRatingChange,
  onSubmit,
}: {
  soldChannel: SoldOffPlatformChannel | null
  elsewhereDetail: string
  elsewhereDetailValid: boolean
  helpedOffPlatform: boolean
  presets: { percent: SaleTipPresetPercent; cents: number }[]
  selectedTipCents: number | null
  customTip: string
  customTipCents: number | null
  rating: number | null
  loading: boolean
  tipCheckout?: ReactNode
  onChannelChange: (channel: SoldOffPlatformChannel) => void
  onDetailChange: (value: string) => void
  onHelpedOffPlatformChange: (value: boolean) => void
  onSelectNoTip: () => void
  onSelectPreset: (cents: number) => void
  onCustomTipChange: (value: string) => void
  onRatingChange: (value: number) => void
  onSubmit: () => void
}) {
  const customTipInvalid = customTip.trim().length > 0 && customTipCents === null
  const hasValidTip = selectedTipCents != null && !customTipInvalid
  const canSubmit =
    !loading &&
    !customTipInvalid &&
    (hasValidTip || (Boolean(soldChannel) && elsewhereDetailValid))
  const noTipSelected = selectedTipCents === null && !customTip.trim()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div
        className={cn(
          "min-h-0 space-y-3 overflow-y-auto overscroll-contain",
          hasValidTip ? "max-h-[min(16rem,34dvh)] shrink-0" : "flex-1",
        )}
      >
        <section className="space-y-1.5">
          <h3 className="text-sm font-medium">Where did you sell it?</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {CHANNELS.map((channel) => (
              <Button
                key={channel}
                type="button"
                size="sm"
                variant={soldChannel === channel ? "default" : "outline"}
                className="h-8 px-2 text-xs"
                disabled={loading}
                title={SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]}
                onClick={() => onChannelChange(channel)}
              >
                {CHANNEL_SHORT_LABELS[channel]}
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
              className="h-8"
            />
          ) : null}
          {soldChannel && soldChannel !== "reswell" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="reswell-helped-find-buyer"
                checked={helpedOffPlatform}
                disabled={loading}
                onCheckedChange={(checked) => onHelpedOffPlatformChange(checked === true)}
              />
              <Label
                htmlFor="reswell-helped-find-buyer"
                className="text-xs font-normal text-muted-foreground"
              >
                Reswell helped find the buyer
              </Label>
            </div>
          ) : null}
        </section>

      <section className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Tip Reswell</h3>
          <p className="text-xs text-muted-foreground">Optional</p>
        </div>
        {hasValidTip ? null : (
          <p className="text-[11px] leading-snug text-muted-foreground">
            We hope you enjoyed your experience here at Reswell. We are working hard every day
            to make Reswell the most enjoyable and trusted place to buy and sell surfboards. If
            you feel inclined to leave a tip and feedback, we highly appreciate it — it helps us
            continue to build Reswell into the surfer&apos;s marketplace we have always dreamed
            of. Thanks again for being a part of Reswell!
            <span className="mt-1 block font-medium text-foreground/80">
              — Hayden Garfield, CEO, Reswell
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={noTipSelected ? "default" : "outline"}
            className="h-8"
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
              className="h-8"
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
          className="h-8"
        />
        {customTipInvalid ? (
          <p className="text-xs text-destructive">
            Enter an amount between {formatTipCents(SALE_TIP_MIN_CENTS)} and {SALE_TIP_MAX_USD_LABEL}.
          </p>
        ) : null}
      </section>

      <section className="space-y-1.5">
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
                size="sm"
                starClassName="fill-yellow-400 text-yellow-400"
              />
            </button>
          ))}
        </div>
      </section>
      </div>

      <section
        className={cn(
          "flex flex-col",
          hasValidTip ? "min-h-0 flex-1" : "shrink-0",
        )}
      >
        {hasValidTip ? (
          <div className="flex h-full min-h-0 flex-col">{tipCheckout}</div>
        ) : (
          <Button type="button" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
            {loading ? "Saving…" : "Done"}
          </Button>
        )}
      </section>
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
