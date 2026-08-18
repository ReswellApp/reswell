"use client"

import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  SALE_TIP_PRESET_CENTS,
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
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

export function MarkSoldChannelStep({
  soldChannel,
  elsewhereDetail,
  elsewhereDetailValid,
  loading,
  onChannelChange,
  onDetailChange,
  onSkip,
  onContinue,
}: {
  soldChannel: SoldOffPlatformChannel | null
  elsewhereDetail: string
  elsewhereDetailValid: boolean
  loading: boolean
  onChannelChange: (channel: SoldOffPlatformChannel) => void
  onDetailChange: (value: string) => void
  onSkip: () => void
  onContinue: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={1} total={3} />
        <h3 className="text-lg font-semibold">Where did you sell it?</h3>
        <p className="text-sm text-muted-foreground">
          This helps us understand how sellers close deals. You can skip anytime.
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
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={loading} onClick={onSkip}>
          Skip
        </Button>
        <Button
          type="button"
          disabled={!soldChannel || !elsewhereDetailValid || loading}
          onClick={onContinue}
        >
          {loading ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  )
}

export function MarkSoldHelpedStep({
  reswellHelped,
  loading,
  onHelpedChange,
  onSkip,
  onContinue,
}: {
  reswellHelped: boolean | null
  loading: boolean
  onHelpedChange: (value: boolean) => void
  onSkip: () => void
  onContinue: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={2} total={3} />
        <h3 className="text-lg font-semibold">Did Reswell help you find a buyer?</h3>
        <p className="text-sm text-muted-foreground">
          Even if you closed the sale elsewhere — listing here or chatting on Reswell counts.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant={reswellHelped === true ? "default" : "outline"}
          className="justify-start"
          onClick={() => onHelpedChange(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={reswellHelped === false ? "default" : "outline"}
          className={cn("justify-start", reswellHelped === false && "border-transparent")}
          onClick={() => onHelpedChange(false)}
        >
          No
        </Button>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={loading} onClick={onSkip}>
          Skip
        </Button>
        <Button
          type="button"
          disabled={reswellHelped === null || loading}
          onClick={onContinue}
        >
          {loading ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  )
}

export function MarkSoldTipAmountStep({
  reswellHelped,
  customTip,
  customTipCents,
  loading,
  onCustomTipChange,
  onSelectPreset,
  onSubmitCustom,
  onSkip,
}: {
  reswellHelped: boolean | null
  customTip: string
  customTipCents: number | null
  loading: boolean
  onCustomTipChange: (value: string) => void
  onSelectPreset: (cents: number) => void
  onSubmitCustom: () => void
  onSkip: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SurveyStepDots current={3} total={3} />
        <h3 className="text-lg font-semibold">Leave a tip? It&apos;s optional</h3>
        <p className="text-sm text-muted-foreground">
          {reswellHelped
            ? "If Reswell helped you connect with a buyer, you can leave a tip. Completely up to you — no pressure."
            : "Want to support Reswell? You can leave an optional tip. Completely up to you."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SALE_TIP_PRESET_CENTS.map((cents) => (
          <Button
            key={cents}
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onSelectPreset(cents)}
          >
            {formatTipCents(cents)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={customTip}
          onChange={(e) => onCustomTipChange(e.target.value)}
          placeholder="Custom amount"
          inputMode="decimal"
          disabled={loading}
          aria-label="Custom tip amount"
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || customTipCents === null}
          onClick={onSubmitCustom}
        >
          Continue
        </Button>
      </div>
      {customTip.trim() && customTipCents === null ? (
        <p className="text-sm text-destructive">Enter an amount between $1 and $500.</p>
      ) : null}
      <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={onSkip}>
        No thanks
      </Button>
    </div>
  )
}

export function MarkSoldThanksStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4 py-2 text-center sm:text-left">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 sm:mx-0" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Thank you</h3>
        <p className="text-sm text-muted-foreground">
          Your tip means a lot. We&apos;ll put it toward keeping Reswell going.
        </p>
      </div>
      <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
