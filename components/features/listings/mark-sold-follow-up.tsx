"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  MarkSoldSurveyForm,
  MarkSoldThanksStep,
} from "@/components/features/listings/mark-sold-survey-steps"
import { submitSoldFlowReswellReviewAction } from "@/lib/actions/reswellPlatformReview"
import { postListingSaleFeedback, postListingSaleTip } from "@/lib/listing-sale-feedback-request"
import {
  SALE_TIP_MAX_CENTS,
  SALE_TIP_MIN_CENTS,
  SALE_TIP_PRESET_PERCENTS,
  saleTipPresetCents,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

const MarkSoldTipCheckout = dynamic(
  () =>
    import("@/components/features/listings/mark-sold-tip-checkout").then((mod) => ({
      default: mod.MarkSoldTipCheckout,
    })),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading payment…</p>,
  },
)

type FollowUpStep = "form" | "checkout" | "thanks"

function parseCustomTipCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, "")
  if (!trimmed) return null
  const dollars = Number(trimmed)
  if (!Number.isFinite(dollars)) return null
  const cents = Math.round(dollars * 100)
  if (cents < SALE_TIP_MIN_CENTS || cents > SALE_TIP_MAX_CENTS) return null
  return cents
}

export function MarkSoldFollowUp({
  listingId,
  listingPriceUsd,
  onClose,
  onFinished,
}: {
  listingId: string
  listingPriceUsd: number | null
  onClose: () => void
  onFinished?: () => void
}) {
  const [step, setStep] = useState<FollowUpStep>("form")
  const [soldChannel, setSoldChannel] = useState<SoldOffPlatformChannel | null>(null)
  const [elsewhereDetail, setElsewhereDetail] = useState("")
  const [helpedOffPlatform, setHelpedOffPlatform] = useState(false)
  const [customTip, setCustomTip] = useState("")
  const [selectedTipCents, setSelectedTipCents] = useState<number | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState<number | null>(null)
  const [reviewText, setReviewText] = useState("")
  const [tipped, setTipped] = useState(false)
  const [loading, setLoading] = useState(false)

  const elsewhereDetailValid =
    soldChannel !== "elsewhere" || elsewhereDetail.trim().length >= 2
  const customTipCents = parseCustomTipCents(customTip)
  const tipPresets = useMemo(() => {
    if (listingPriceUsd == null || listingPriceUsd <= 0) return []
    return SALE_TIP_PRESET_PERCENTS.flatMap((percent) => {
      const cents = saleTipPresetCents(listingPriceUsd, percent)
      return cents == null ? [] : [{ percent, cents }]
    })
  }, [listingPriceUsd])

  function finish() {
    onFinished?.()
    setStep("thanks")
  }

  async function saveFeedbackAndReview(): Promise<boolean> {
    if (!soldChannel || !elsewhereDetailValid) return false

    const [feedbackResult, reviewResult] = await Promise.all([
      postListingSaleFeedback(listingId, {
        channel: soldChannel,
        detail: soldChannel === "elsewhere" ? elsewhereDetail.trim() : undefined,
        reswellHelpedFindBuyer: soldChannel === "reswell" || helpedOffPlatform,
      }),
      reviewRating == null
        ? Promise.resolve(null)
        : submitSoldFlowReswellReviewAction({
            rating: reviewRating,
            description: reviewText,
          }),
    ])

    if (!feedbackResult.ok) {
      toast.error(feedbackResult.error)
      return false
    }
    if (reviewResult && "error" in reviewResult) {
      toast.error(reviewResult.error)
      return false
    }
    return true
  }

  async function startTip(amountCents: number): Promise<boolean> {
    const result = await postListingSaleTip(listingId, amountCents)
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setSelectedTipCents(result.amountCents)
    setClientSecret(result.clientSecret)
    setStep("checkout")
    return true
  }

  async function handleSubmit() {
    if (!soldChannel || !elsewhereDetailValid) return
    if (customTip.trim() && customTipCents === null) return

    const tipCents = customTipCents ?? selectedTipCents
    setLoading(true)
    try {
      const saved = await saveFeedbackAndReview()
      if (!saved) return
      if (tipCents != null) {
        await startTip(tipCents)
        return
      }
      finish()
    } finally {
      setLoading(false)
    }
  }

  if (step === "thanks") {
    return <MarkSoldThanksStep tipped={tipped} onClose={onClose} />
  }

  if (step === "checkout" && clientSecret && selectedTipCents) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">Complete your tip</h3>
          <p className="text-sm text-muted-foreground">
            Secure checkout with Stripe. You can change the amount or skip.
          </p>
        </div>
        <MarkSoldTipCheckout
          clientSecret={clientSecret}
          amountCents={selectedTipCents}
          onSuccess={() => {
            toast.success("Tip sent. Thank you.")
            setTipped(true)
            setClientSecret(null)
            finish()
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setClientSecret(null)
              setStep("form")
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setClientSecret(null)
              finish()
            }}
          >
            No thanks
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MarkSoldSurveyForm
      soldChannel={soldChannel}
      elsewhereDetail={elsewhereDetail}
      elsewhereDetailValid={elsewhereDetailValid}
      helpedOffPlatform={helpedOffPlatform}
      listingPriceUsd={listingPriceUsd}
      presets={tipPresets}
      selectedTipCents={selectedTipCents}
      customTip={customTip}
      customTipCents={customTipCents}
      rating={reviewRating}
      review={reviewText}
      loading={loading}
      onChannelChange={(channel) => {
        setSoldChannel(channel)
        if (channel === "reswell") setHelpedOffPlatform(false)
      }}
      onDetailChange={setElsewhereDetail}
      onHelpedOffPlatformChange={setHelpedOffPlatform}
      onSelectNoTip={() => {
        setSelectedTipCents(null)
        setCustomTip("")
      }}
      onSelectPreset={(cents) => {
        setCustomTip("")
        setSelectedTipCents(cents)
      }}
      onCustomTipChange={(value) => {
        setCustomTip(value)
        setSelectedTipCents(parseCustomTipCents(value))
      }}
      onRatingChange={setReviewRating}
      onReviewChange={setReviewText}
      onSubmit={() => void handleSubmit()}
    />
  )
}
