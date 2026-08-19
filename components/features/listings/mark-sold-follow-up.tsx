"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  MarkSoldChannelStep,
  MarkSoldHelpedStep,
  MarkSoldReviewStep,
  MarkSoldThanksStep,
  MarkSoldTipAmountStep,
} from "@/components/features/listings/mark-sold-survey-steps"

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
import { submitSoldFlowReswellReviewAction } from "@/lib/actions/reswellPlatformReview"
import { postListingSaleFeedback, postListingSaleTip } from "@/lib/listing-sale-feedback-request"
import {
  SALE_TIP_MAX_CENTS,
  SALE_TIP_MIN_CENTS,
  SALE_TIP_PRESET_PERCENTS,
  saleTipPresetCents,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

type FollowUpStep = "channel" | "helped" | "tip" | "review" | "thanks"

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
}: {
  listingId: string
  listingPriceUsd: number | null
  onClose: () => void
}) {
  const [step, setStep] = useState<FollowUpStep>("channel")
  const [soldChannel, setSoldChannel] = useState<SoldOffPlatformChannel | null>(null)
  const [elsewhereDetail, setElsewhereDetail] = useState("")
  const [reswellHelped, setReswellHelped] = useState<boolean | null>(null)
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

  async function saveChannelAndContinue() {
    if (!soldChannel || !elsewhereDetailValid) return
    setLoading(true)
    try {
      const result = await postListingSaleFeedback(listingId, {
        channel: soldChannel,
        detail: soldChannel === "elsewhere" ? elsewhereDetail.trim() : undefined,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStep("helped")
    } finally {
      setLoading(false)
    }
  }

  async function saveHelpedAndContinue() {
    if (reswellHelped === null) return
    setLoading(true)
    try {
      const result = await postListingSaleFeedback(listingId, {
        reswellHelpedFindBuyer: reswellHelped,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStep(reswellHelped ? "tip" : "review")
    } finally {
      setLoading(false)
    }
  }

  async function startTip(amountCents: number) {
    setLoading(true)
    try {
      const result = await postListingSaleTip(listingId, amountCents)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSelectedTipCents(result.amountCents)
      setClientSecret(result.clientSecret)
    } finally {
      setLoading(false)
    }
  }

  function goToReview() {
    setClientSecret(null)
    setSelectedTipCents(null)
    setStep("review")
  }

  async function submitReview() {
    if (reviewRating == null) return
    setLoading(true)
    try {
      const result = await submitSoldFlowReswellReviewAction({
        rating: reviewRating,
        description: reviewText,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setStep("thanks")
    } finally {
      setLoading(false)
    }
  }

  if (step === "thanks") {
    return <MarkSoldThanksStep tipped={tipped} onClose={onClose} />
  }

  if (step === "review") {
    return (
      <MarkSoldReviewStep
        rating={reviewRating}
        review={reviewText}
        loading={loading}
        onRatingChange={setReviewRating}
        onReviewChange={setReviewText}
        onBack={() => setStep(reswellHelped ? "tip" : "helped")}
        onContinue={() => void submitReview()}
        stepCurrent={reswellHelped ? 4 : 3}
        stepTotal={reswellHelped ? 4 : 3}
      />
    )
  }

  if (step === "helped") {
    return (
      <MarkSoldHelpedStep
        selected={reswellHelped}
        loading={loading}
        onHelpedChange={setReswellHelped}
        onBack={() => setStep("channel")}
        onContinue={() => void saveHelpedAndContinue()}
        stepTotal={reswellHelped ? 4 : 3}
      />
    )
  }

  if (step === "tip" && clientSecret && selectedTipCents) {
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
            goToReview()
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setClientSecret(null)
              setSelectedTipCents(null)
            }}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <Button type="button" variant="ghost" disabled={loading} onClick={goToReview}>
            No thanks
          </Button>
        </div>
      </div>
    )
  }

  if (step === "tip") {
    return (
      <MarkSoldTipAmountStep
        reswellHelped={reswellHelped}
        listingPriceUsd={listingPriceUsd}
        presets={tipPresets}
        customTip={customTip}
        customTipCents={customTipCents}
        loading={loading}
        onCustomTipChange={setCustomTip}
        onSelectPreset={(cents) => void startTip(cents)}
        onSubmitCustom={() => {
          if (customTipCents !== null) void startTip(customTipCents)
        }}
        onBack={() => {
          setClientSecret(null)
          setSelectedTipCents(null)
          setStep("helped")
        }}
        onNoThanks={goToReview}
      />
    )
  }

  return (
    <MarkSoldChannelStep
      soldChannel={soldChannel}
      elsewhereDetail={elsewhereDetail}
      elsewhereDetailValid={elsewhereDetailValid}
      loading={loading}
      onChannelChange={setSoldChannel}
      onDetailChange={setElsewhereDetail}
      onContinue={() => void saveChannelAndContinue()}
    />
  )
}
