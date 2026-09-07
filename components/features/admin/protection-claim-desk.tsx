"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  ExternalLink,
  Loader2,
  Package,
  Shield,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import {
  getProtectionClaimDeskAction,
  grantProtectionRepairCreditAction,
  updateProtectionCarrierClaimAction,
} from "@/lib/actions/protectionClaimDesk"
import { SUPPORT_CASE_EVIDENCE_UPDATED_EVENT } from "@/components/features/admin/admin-marketplace-message-body"
import {
  CARRIER_CLAIM_STATUS_LABEL,
  SUPPORT_EVIDENCE_KIND_LABEL,
  type CarrierClaimStatus,
} from "@/lib/types/protectionClaimDesk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type DeskEvidence = {
  id: string
  evidence_kind: string
  file_name: string
  signedUrl: string | null
  created_at: string
}

type DeskContext = {
  trackingNumber: string | null
  trackingCarrier: string | null
  insuranceClaimUrl: string | null
  insuranceProvider: string | null
  insuredValueAmount: number | null
  shipengineLabelId: string | null
  upsLossDamageFormUrl: string
  orderAmount: number | null
  orderStatus: string | null
}

interface ProtectionClaimDeskProps {
  orderSupportRequestId: string
  orderId: string
  initialCarrierClaimStatus: CarrierClaimStatus | null
  initialCarrierClaimId: string | null
  initialCarrierClaimUrl: string | null
  initialInsuranceClaimUrl: string | null
  initialRepairCreditTotal: number
}

export function ProtectionClaimDesk({
  orderSupportRequestId,
  orderId,
  initialCarrierClaimStatus,
  initialCarrierClaimId,
  initialCarrierClaimUrl,
  initialInsuranceClaimUrl,
  initialRepairCreditTotal,
}: ProtectionClaimDeskProps) {
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<DeskContext | null>(null)
  const [evidence, setEvidence] = useState<DeskEvidence[]>([])

  const [claimStatus, setClaimStatus] = useState<string>(
    initialCarrierClaimStatus ?? "not_started",
  )
  const [claimId, setClaimId] = useState(initialCarrierClaimId ?? "")
  const [claimUrl, setClaimUrl] = useState(
    initialCarrierClaimUrl?.trim() || initialInsuranceClaimUrl?.trim() || "",
  )
  const [creditAmount, setCreditAmount] = useState("")
  const [creditNote, setCreditNote] = useState("")
  const [repairTotal, setRepairTotal] = useState(initialRepairCreditTotal)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getProtectionClaimDeskAction(orderSupportRequestId)
      if (cancelled) return
      if ("error" in res) {
        toast.error(res.error)
        setLoading(false)
        return
      }
      setContext(res.context)
      setEvidence(res.evidence)
      if (res.caseRow) {
        setClaimStatus(res.caseRow.carrier_claim_status ?? "not_started")
        setClaimId(res.caseRow.carrier_claim_id ?? "")
        const savedUrl =
          res.caseRow.carrier_claim_url?.trim() ||
          res.caseRow.insurance_claim_url?.trim() ||
          res.context.insuranceClaimUrl?.trim() ||
          ""
        setClaimUrl(savedUrl)
        setRepairTotal(res.caseRow.repair_credit_total ?? 0)
      } else if (res.context.insuranceClaimUrl) {
        setClaimUrl(res.context.insuranceClaimUrl)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orderSupportRequestId])

  useEffect(() => {
    function onEvidenceUpdated(ev: Event) {
      const detail = (ev as CustomEvent<{ orderSupportRequestId?: string }>).detail
      if (detail?.orderSupportRequestId && detail.orderSupportRequestId !== orderSupportRequestId) {
        return
      }
      void (async () => {
        const res = await getProtectionClaimDeskAction(orderSupportRequestId)
        if ("error" in res) return
        setEvidence(res.evidence)
      })()
    }
    window.addEventListener(SUPPORT_CASE_EVIDENCE_UPDATED_EVENT, onEvidenceUpdated)
    return () => {
      window.removeEventListener(SUPPORT_CASE_EVIDENCE_UPDATED_EVENT, onEvidenceUpdated)
    }
  }, [orderSupportRequestId])

  function saveCarrierClaim(notify = false) {
    startTransition(async () => {
      const trimmedUrl = claimUrl.trim() || null
      const parcelguardUrl = context?.insuranceClaimUrl?.trim() || null
      const res = await updateProtectionCarrierClaimAction({
        order_support_request_id: orderSupportRequestId,
        carrier_claim_status: claimStatus as CarrierClaimStatus,
        carrier_claim_id: claimId.trim() || null,
        carrier_claim_url: trimmedUrl,
        ...(parcelguardUrl ? { insurance_claim_url: parcelguardUrl } : {}),
        notify_customer: notify,
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success(notify ? "Claim saved and customer notified" : "Carrier claim saved")
    })
  }

  function grantCredit() {
    const amount = Number(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid credit amount")
      return
    }
    startTransition(async () => {
      const res = await grantProtectionRepairCreditAction({
        order_support_request_id: orderSupportRequestId,
        amount_usd: Math.round(amount * 100) / 100,
        note: creditNote.trim() || undefined,
        set_outcome_partial: true,
        notify_customer: true,
      })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setRepairTotal((t) => Math.round((t + res.amount_usd) * 100) / 100)
      setCreditAmount("")
      setCreditNote("")
      toast.success(`Credited $${res.amount_usd.toFixed(2)} to buyer wallet`)
    })
  }

  const upsFormUrl = context?.upsLossDamageFormUrl?.trim() || null
  const parcelguardUrl = context?.insuranceClaimUrl?.trim() || null
  const hasParcelGuard = Boolean(
    parcelguardUrl ||
      (context?.insuranceProvider &&
        context.insuranceProvider !== "none" &&
        context.insuranceProvider.trim()),
  )

  return (
    <div className="space-y-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.03] p-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
          Protection claim desk
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading shipment context…
        </p>
      ) : (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {context?.trackingCarrier || "Carrier"} ·{" "}
              {context?.trackingNumber || "No tracking yet"}
              {context?.orderStatus ? ` · order ${context.orderStatus}` : ""}
              {context?.orderAmount != null
                ? ` · $${context.orderAmount.toFixed(2)}`
                : ""}
            </span>
          </p>
          {hasParcelGuard ? (
            <p>
              ParcelGuard on this label
              {context?.insuredValueAmount != null
                ? ` · insured $${context.insuredValueAmount.toFixed(2)}`
                : ""}
            </p>
          ) : (
            <p>No ParcelGuard on this label — file a UPS carrier claim below.</p>
          )}
        </div>
      )}

      {evidence.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence
          </p>
          <div className="grid grid-cols-2 gap-2">
            {evidence.map((e) => (
              <a
                key={e.id}
                href={e.signedUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-border/60 bg-background"
              >
                {e.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.signedUrl} alt={e.file_name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center p-2 text-[10px] text-muted-foreground">
                    {e.file_name}
                  </div>
                )}
                <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                  {SUPPORT_EVIDENCE_KIND_LABEL[
                    e.evidence_kind as keyof typeof SUPPORT_EVIDENCE_KIND_LABEL
                  ] ?? e.evidence_kind}
                </p>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No evidence photos on this claim yet.</p>
      )}

      <div className="space-y-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Carrier claim
        </Label>
        <p className="text-xs text-muted-foreground">
          File externally, then paste the claim ID / link here so this case stays linked.
        </p>
        <Select value={claimStatus} onValueChange={setClaimStatus}>
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CARRIER_CLAIM_STATUS_LABEL) as CarrierClaimStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {CARRIER_CLAIM_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          placeholder="Claim ID / reference"
          className="h-9 bg-background text-sm"
        />
        <Input
          value={claimUrl}
          onChange={(e) => setClaimUrl(e.target.value)}
          placeholder="Claim URL (optional)"
          className="h-9 bg-background text-sm"
        />
        <div className="flex flex-col gap-1.5">
          {upsFormUrl ? (
            <Button type="button" size="sm" className="w-full" asChild>
              <a href={upsFormUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                File UPS claim
              </a>
            </Button>
          ) : null}
          {parcelguardUrl ? (
            <Button type="button" size="sm" variant="secondary" className="w-full" asChild>
              <a href={parcelguardUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open ParcelGuard claim
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => saveCarrierClaim(false)}
          >
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save claim status
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => saveCarrierClaim(true)}
          >
            Save + notify buyer
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-border/50 pt-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Repair credit
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Granted so far: <strong className="text-foreground">${repairTotal.toFixed(2)}</strong>
          {context?.orderAmount != null
            ? ` · order total $${context.orderAmount.toFixed(2)}`
            : ""}
        </p>
        <Input
          type="number"
          min={0.01}
          step={0.01}
          value={creditAmount}
          onChange={(e) => setCreditAmount(e.target.value)}
          placeholder="Amount (USD)"
          className="h-9 bg-background text-sm"
        />
        <Textarea
          value={creditNote}
          onChange={(e) => setCreditNote(e.target.value)}
          rows={2}
          placeholder="Optional note to buyer…"
          className="resize-y bg-background text-sm"
        />
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={grantCredit}
        >
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Credit wallet + set outcome partial
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full" asChild>
          <Link href={`/admin/orders/${orderId}`}>Full refund / return tools</Link>
        </Button>
      </div>
    </div>
  )
}
