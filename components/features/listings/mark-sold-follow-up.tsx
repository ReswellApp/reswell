"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
  MarkSoldSurveyForm,
  MarkSoldThanksStep,
  MarkSoldTipCheckoutPlaceholder,
} from "@/components/features/listings/mark-sold-survey-steps"
import { submitSoldFlowReswellReviewAction } from "@/lib/actions/reswellPlatformReview"
import { postListingSaleFeedback, postListingSaleTip } from "@/lib/listing-sale-feedback-request"
import { postMarkListingSold } from "@/lib/listing-mark-sold-request"
import { prefetchSaleTipCheckout } from "@/lib/stripe/prefetch-sale-tip-checkout"
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
    loading: () => <MarkSoldTipCheckoutPlaceholder />,
  },
)

type FollowUpStep = "form" | "thanks"

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
  onCheckoutActiveChange,
  onMarkedSold,
}: {
  listingId: string
  listingPriceUsd: number | null
  onClose: () => void
  onFinished?: () => void
  onCheckoutActiveChange?: (active: boolean) => void
  onMarkedSold?: () => void
}) {
  const [step, setStep] = useState<FollowUpStep>("form")
  const [soldChannel, setSoldChannel] = useState<SoldOffPlatformChannel | null>(null)
  const [elsewhereDetail, setElsewhereDetail] = useState("")
  const [helpedOffPlatform, setHelpedOffPlatform] = useState(false)
  const [customTip, setCustomTip] = useState("")
  const [selectedTipCents, setSelectedTipCents] = useState<number | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState<number | null>(null)
  const [tipped, setTipped] = useState(false)
  const [loading, setLoading] = useState(false)

  const onCheckoutActiveChangeRef = useRef(onCheckoutActiveChange)
  onCheckoutActiveChangeRef.current = onCheckoutActiveChange
  const startedForRef = useRef<number | null>(null)
  const clientSecretRef = useRef<string | null>(null)
  const tipSecretsRef = useRef<Map<number, string>>(new Map())
  const tipInflightRef = useRef<Map<number, Promise<string | null>>>(new Map())
  const customTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listingIdRef = useRef(listingId)
  listingIdRef.current = listingId

  useEffect(() => {
    void prefetchSaleTipCheckout()
  }, [])

  const elsewhereDetailValid =
    soldChannel !== "elsewhere" || elsewhereDetail.trim().length >= 2
  const customTipCents = parseCustomTipCents(customTip)
  const activeTipCents = customTip.trim() ? customTipCents : selectedTipCents
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

  async function confirmListingSold(): Promise<boolean> {
    const channel = soldChannel
    const result = await postMarkListingSold(
      listingId,
      channel
        ? {
            channel,
            detail: channel === "elsewhere" ? elsewhereDetail.trim() : undefined,
            reswellHelpedFindBuyer: channel === "reswell" || helpedOffPlatform,
          }
        : {},
    )
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    onMarkedSold?.()
    return true
  }

  async function saveFeedbackAndReview(): Promise<boolean> {
    const channel = soldChannel
    const rating = reviewRating
    const shouldSaveFeedback = Boolean(channel && elsewhereDetailValid)
    if (!shouldSaveFeedback && rating == null) return true

    try {
      const [feedbackResult, reviewResult] = await Promise.all([
        shouldSaveFeedback && channel
          ? postListingSaleFeedback(listingId, {
              channel,
              detail: channel === "elsewhere" ? elsewhereDetail.trim() : undefined,
              reswellHelpedFindBuyer: channel === "reswell" || helpedOffPlatform,
            })
          : Promise.resolve(null),
        rating != null
          ? submitSoldFlowReswellReviewAction({
              rating,
              description: "",
            })
          : Promise.resolve(null),
      ])

      if (feedbackResult && !feedbackResult.ok) {
        toast.error(feedbackResult.error)
        return false
      }
      if (reviewResult && "error" in reviewResult) {
        toast.error(reviewResult.error)
      }
      return !feedbackResult || feedbackResult.ok
    } catch (error) {
      console.error("Sale follow-up save failed", error)
      return false
    }
  }

  const ensureTipSecret = useCallback(async (amountCents: number): Promise<string | null> => {
    const cached = tipSecretsRef.current.get(amountCents)
    if (cached) return cached

    const inflight = tipInflightRef.current.get(amountCents)
    if (inflight) return inflight

    const request = postListingSaleTip(listingIdRef.current, amountCents)
      .then((result) => {
        if (!result.ok) return null
        tipSecretsRef.current.set(result.amountCents, result.clientSecret)
        return result.clientSecret
      })
      .catch((error: unknown) => {
        console.error("Sale tip start failed", error)
        return null
      })
      .finally(() => {
        tipInflightRef.current.delete(amountCents)
      })

    tipInflightRef.current.set(amountCents, request)
    return request
  }, [])

  const startCheckout = useCallback(
    async (amountCents: number): Promise<boolean> => {
      startedForRef.current = amountCents
      const cached = tipSecretsRef.current.get(amountCents)
      if (cached) {
        clientSecretRef.current = cached
        setClientSecret(cached)
        setSelectedTipCents(amountCents)
        onCheckoutActiveChangeRef.current?.(true)
        return true
      }

      onCheckoutActiveChangeRef.current?.(true)
      const secret = await ensureTipSecret(amountCents)
      if (startedForRef.current !== amountCents) return false
      if (!secret) {
        startedForRef.current = null
        clientSecretRef.current = null
        setClientSecret(null)
        onCheckoutActiveChangeRef.current?.(false)
        toast.error("Could not start tip payment. Try again.")
        return false
      }
      clientSecretRef.current = secret
      setSelectedTipCents(amountCents)
      setClientSecret(secret)
      return true
    },
    [ensureTipSecret],
  )

  useEffect(() => {
    if (tipPresets.length === 0) return
    for (const preset of tipPresets) {
      void ensureTipSecret(preset.cents)
    }
  }, [ensureTipSecret, tipPresets])

  useEffect(() => {
    return () => {
      if (customTipTimerRef.current != null) {
        window.clearTimeout(customTipTimerRef.current)
      }
    }
  }, [])

  function clearTip() {
    if (customTipTimerRef.current != null) {
      window.clearTimeout(customTipTimerRef.current)
      customTipTimerRef.current = null
    }
    startedForRef.current = null
    clientSecretRef.current = null
    setSelectedTipCents(null)
    setCustomTip("")
    setClientSecret(null)
    onCheckoutActiveChangeRef.current?.(false)
  }

  async function handleSubmit() {
    if (customTip.trim() && customTipCents === null) return

    const tipCents = activeTipCents
    setLoading(true)
    try {
      if (tipCents != null) {
        const started = await startCheckout(tipCents)
        if (!started) return
        return
      }
      if (!soldChannel || !elsewhereDetailValid) {
        toast.error("Tell us where you sold it, or add a tip.")
        return
      }
      const marked = await confirmListingSold()
      if (!marked) return
      const saved = await saveFeedbackAndReview()
      if (!saved) return
      finish()
    } catch (error) {
      console.error("Sale follow-up submit failed", error)
      toast.error("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (step === "thanks") {
    return <MarkSoldThanksStep tipped={tipped} onClose={onClose} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <MarkSoldSurveyForm
        soldChannel={soldChannel}
        elsewhereDetail={elsewhereDetail}
        elsewhereDetailValid={elsewhereDetailValid}
        helpedOffPlatform={helpedOffPlatform}
        presets={tipPresets}
        selectedTipCents={selectedTipCents}
        customTip={customTip}
        customTipCents={customTipCents}
        rating={reviewRating}
        loading={loading}
        tipCheckout={
          activeTipCents != null ? (
            clientSecret ? (
              <MarkSoldTipCheckout
                listingId={listingId}
                clientSecret={clientSecret}
                amountCents={activeTipCents}
                onSuccess={() => {
                  void (async () => {
                    const marked = await confirmListingSold()
                    if (!marked) return
                    toast.success("Tip sent. Thank you.")
                    setTipped(true)
                    clientSecretRef.current = null
                    setClientSecret(null)
                    startedForRef.current = null
                    onCheckoutActiveChangeRef.current?.(false)
                    void saveFeedbackAndReview()
                    finish()
                  })()
                }}
              />
            ) : (
              <MarkSoldTipCheckoutPlaceholder />
            )
          ) : null
        }
        onChannelChange={(channel) => {
          setSoldChannel(channel)
          if (channel === "reswell") setHelpedOffPlatform(false)
        }}
        onDetailChange={setElsewhereDetail}
        onHelpedOffPlatformChange={setHelpedOffPlatform}
        onSelectNoTip={clearTip}
        onSelectPreset={(cents) => {
          if (customTipTimerRef.current != null) {
            window.clearTimeout(customTipTimerRef.current)
            customTipTimerRef.current = null
          }
          setCustomTip("")
          setSelectedTipCents(cents)
          const cached = tipSecretsRef.current.get(cents)
          if (cached) {
            startedForRef.current = cents
            clientSecretRef.current = cached
            setClientSecret(cached)
            onCheckoutActiveChangeRef.current?.(true)
            return
          }
          void startCheckout(cents)
        }}
        onCustomTipChange={(value) => {
          setCustomTip(value)
          const cents = parseCustomTipCents(value)
          setSelectedTipCents(cents)
          if (customTipTimerRef.current != null) {
            window.clearTimeout(customTipTimerRef.current)
            customTipTimerRef.current = null
          }
          if (cents == null) {
            startedForRef.current = null
            clientSecretRef.current = null
            setClientSecret(null)
            onCheckoutActiveChangeRef.current?.(false)
            return
          }
          customTipTimerRef.current = window.setTimeout(() => {
            void startCheckout(cents)
          }, 450)
        }}
        onRatingChange={setReviewRating}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  )
}
