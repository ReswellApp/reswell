"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  MarkSoldChannelStep,
  MarkSoldHelpedStep,
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
import { postListingSaleFeedback, postListingSaleTip } from "@/lib/listing-sale-feedback-request"
import {
  SALE_TIP_MAX_CENTS,
  SALE_TIP_MIN_CENTS,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

type FollowUpStep = "channel" | "helped" | "tip" | "thanks"

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
  onClose,
}: {
  listingId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<FollowUpStep>("channel")
  const [soldChannel, setSoldChannel] = useState<SoldOffPlatformChannel | null>(null)
  const [elsewhereDetail, setElsewhereDetail] = useState("")
  const [reswellHelped, setReswellHelped] = useState<boolean | null>(null)
  const [customTip, setCustomTip] = useState("")
  const [selectedTipCents, setSelectedTipCents] = useState<number | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const elsewhereDetailValid =
    soldChannel !== "elsewhere" || elsewhereDetail.trim().length >= 2
  const customTipCents = parseCustomTipCents(customTip)

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
      setStep("tip")
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

  if (step === "thanks") {
    return <MarkSoldThanksStep onClose={onClose} />
  }

  if (step === "helped") {
    return (
      <MarkSoldHelpedStep
        reswellHelped={reswellHelped}
        loading={loading}
        onHelpedChange={setReswellHelped}
        onSkip={() => setStep("tip")}
        onContinue={() => void saveHelpedAndContinue()}
      />
    )
  }

  if (step === "tip" && clientSecret && selectedTipCents) {
    return (
      <div className="space-y-3">
        <MarkSoldTipCheckout
          clientSecret={clientSecret}
          amountCents={selectedTipCents}
          onSuccess={() => {
            toast.success("Tip sent — thank you")
            setStep("thanks")
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={loading}
          onClick={() => {
            setClientSecret(null)
            setSelectedTipCents(null)
          }}
        >
          Change amount
        </Button>
        <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={onClose}>
          No thanks
        </Button>
      </div>
    )
  }

  if (step === "tip") {
    return (
      <MarkSoldTipAmountStep
        reswellHelped={reswellHelped}
        customTip={customTip}
        customTipCents={customTipCents}
        loading={loading}
        onCustomTipChange={setCustomTip}
        onSelectPreset={(cents) => void startTip(cents)}
        onSubmitCustom={() => {
          if (customTipCents !== null) void startTip(customTipCents)
        }}
        onSkip={onClose}
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
      onSkip={() => setStep("helped")}
      onContinue={() => void saveChannelAndContinue()}
    />
  )
}
