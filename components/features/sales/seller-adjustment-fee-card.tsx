"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { submitShippingAdjustmentDisputeAction } from "@/lib/actions/shippingAdjustmentDispute"
import {
  ADJUSTMENT_DISPUTE_CARRIERS,
  ADJUSTMENT_DISPUTE_REASON_CODES,
  adjustmentCarrierLabel,
  adjustmentDisputeReasonLabel,
  adjustmentDisputeStatusLabel,
  formatAdjustmentUsd,
  sellerAdjustmentFeeExplanation,
  type AdjustmentDisputeCarrier,
  type AdjustmentDisputeReasonCode,
} from "@/lib/shipping/adjustment-fee"
import type { SellerAdjustmentFeeView } from "@/lib/shipping/adjustment-fee"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface SellerAdjustmentFeeCardProps {
  orderId: string
  buyerShippingUsd: number
  fees: SellerAdjustmentFeeView[]
}

export function SellerAdjustmentFeeCard({
  orderId,
  buyerShippingUsd,
  fees,
}: SellerAdjustmentFeeCardProps) {
  if (fees.length === 0) return null
  const total = fees.reduce((sum, fee) => sum + fee.amountUsd, 0)

  return (
    <section className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Adjustment fee</h2>
        <p className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
          −{formatAdjustmentUsd(total)}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {sellerAdjustmentFeeExplanation({
          amountUsd: total,
          buyerShippingUsd,
          lengthIn: fees.length === 1 ? fees[0].lengthIn : null,
          widthIn: fees.length === 1 ? fees[0].widthIn : null,
          heightIn: fees.length === 1 ? fees[0].heightIn : null,
        })}
      </p>
      <div className="mt-4 space-y-4">
        {fees.map((fee) => (
          <FeeDispute
            key={fee.id}
            orderId={orderId}
            fee={fee}
            showAmount={fees.length > 1}
          />
        ))}
      </div>
    </section>
  )
}

function FeeDispute({
  orderId,
  fee,
  showAmount,
}: {
  orderId: string
  fee: SellerAdjustmentFeeView
  showAmount: boolean
}) {
  const [carrier, setCarrier] = useState<AdjustmentDisputeCarrier>(fee.suggestedCarrier ?? "ups")
  const [reasonCode, setReasonCode] = useState<AdjustmentDisputeReasonCode>("dimensions_match_label")
  const [statement, setStatement] = useState("")
  const [lengthIn, setLengthIn] = useState("")
  const [widthIn, setWidthIn] = useState("")
  const [heightIn, setHeightIn] = useState("")
  const [weightLb, setWeightLb] = useState("")
  const [pending, startTransition] = useTransition()

  if (fee.dispute) {
    const name = adjustmentCarrierLabel(fee.dispute.carrier)
    return (
      <div className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm">
        <p className="font-semibold text-foreground">
          {name} dispute · {adjustmentDisputeStatusLabel(fee.dispute.status)}
          {showAmount ? ` · ${formatAdjustmentUsd(fee.amountUsd)}` : ""}
        </p>
        <p className="mt-1 leading-relaxed text-muted-foreground">{fee.dispute.sellerStatement}</p>
        {fee.dispute.status === "submitted_to_reswell" ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Reswell has this dispute and will submit it to {name}.
          </p>
        ) : null}
        {fee.dispute.status === "submitted_to_carrier" ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Reswell submitted this dispute to {name}
            {fee.dispute.carrierReference ? ` (${fee.dispute.carrierReference})` : ""}.
          </p>
        ) : null}
        {fee.dispute.reswellNote ? (
          <p className="mt-2 text-xs leading-relaxed text-foreground">{fee.dispute.reswellNote}</p>
        ) : null}
      </div>
    )
  }

  function optionalNumber(value: string): number | undefined {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border/70 bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await submitShippingAdjustmentDisputeAction({
            orderId,
            adjustmentId: fee.id,
            carrier,
            reasonCode,
            sellerStatement: statement,
            claimedLengthIn: optionalNumber(lengthIn),
            claimedWidthIn: optionalNumber(widthIn),
            claimedHeightIn: optionalNumber(heightIn),
            claimedWeightLb: optionalNumber(weightLb),
          })
          if ("error" in result && result.error) {
            toast.error(result.error)
            return
          }
          toast.success(`Dispute sent to Reswell for ${adjustmentCarrierLabel(carrier)}.`)
        })
      }}
    >
      <p className="text-sm font-semibold text-foreground">
        Dispute this fee with Reswell
        {showAmount ? ` · ${formatAdjustmentUsd(fee.amountUsd)}` : ""}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Choose UPS, FedEx, or USPS. Reswell reviews it, then submits that dispute to the carrier.
      </p>
      <label className="block text-xs font-medium text-foreground">
        Carrier
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          value={carrier}
          onChange={(event) => setCarrier(event.target.value as AdjustmentDisputeCarrier)}
        >
          {ADJUSTMENT_DISPUTE_CARRIERS.map((value) => (
            <option key={value} value={value}>
              {adjustmentCarrierLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-foreground">
        Reason
        <select
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value as AdjustmentDisputeReasonCode)}
        >
          {ADJUSTMENT_DISPUTE_REASON_CODES.map((value) => (
            <option key={value} value={value}>
              {adjustmentDisputeReasonLabel(carrier, value)}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        value={statement}
        onChange={(event) => setStatement(event.target.value)}
        minLength={20}
        maxLength={2000}
        required
        placeholder="What should Reswell tell the carrier? Include how you measured the packed box."
        className="min-h-24 text-sm"
      />
      <div className="grid grid-cols-4 gap-2">
        <DimField label="L" value={lengthIn} onChange={setLengthIn} />
        <DimField label="W" value={widthIn} onChange={setWidthIn} />
        <DimField label="H" value={heightIn} onChange={setHeightIn} />
        <DimField label="lb" value={weightLb} onChange={setWeightLb} />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : `Send ${adjustmentCarrierLabel(carrier)} dispute to Reswell`}
      </Button>
    </form>
  )
}

function DimField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-[10px] font-medium text-muted-foreground">
      {label}
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      />
    </label>
  )
}
