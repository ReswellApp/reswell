"use client"

import { useState, useTransition } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { issueOrderSupportCaseRefundAction } from "@/lib/actions/orderSupportCaseRefund"
import {
  ADMIN_REFUND_DISPOSITION_OPTIONS,
  DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION,
  type MarketplaceOrderRefundDisposition,
} from "@/lib/services/marketplaceOrderRefundDisposition"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

type CaseIssueRefundPanelProps = {
  caseId: string
  orderId: string
  orderRef: string
  orderStatus: string
  amount: number
  shippingAmount?: number
  paymentMethod: string
  repairCreditTotal: number
  canIssueRefund: boolean
  onComplete?: () => void
}

export function CaseIssueRefundPanel({
  caseId,
  orderId,
  orderRef,
  orderStatus,
  amount,
  shippingAmount = 0,
  paymentMethod,
  repairCreditTotal,
  canIssueRefund,
  onComplete,
}: CaseIssueRefundPanelProps) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [allowAfterCredit, setAllowAfterCredit] = useState(false)
  const [disposition, setDisposition] = useState<MarketplaceOrderRefundDisposition>(
    DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION,
  )

  if (orderStatus === "refunded") {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        This order is already refunded.
      </p>
    )
  }

  if (orderStatus !== "confirmed" && orderStatus !== "refunding") {
    return null
  }

  if (!canIssueRefund) {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Refunds from a case require an admin. Use Assign me, then ask an admin to issue the refund
        here — it stays on this case instead of Messages.
      </p>
    )
  }

  const isCard = paymentMethod === "stripe"
  const shippingUsd = Number.isFinite(shippingAmount) ? Math.max(0, shippingAmount) : 0
  const selected =
    ADMIN_REFUND_DISPOSITION_OPTIONS.find((o) => o.value === disposition) ??
    ADMIN_REFUND_DISPOSITION_OPTIONS[0]!
  const needsCreditConfirm = repairCreditTotal > 0 && !allowAfterCredit

  function submit() {
    startTransition(async () => {
      const res = await issueOrderSupportCaseRefundAction({
        case_id: caseId,
        order_id: orderId,
        disposition,
        allow_after_repair_credit: allowAfterCredit,
        notify_customer: true,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.message, { duration: 10_000 })
      setOpen(false)
      onComplete?.()
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Refund on this case
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Refunds ${amount.toFixed(2)} for order {orderRef} to the buyer’s{" "}
          {isCard ? "card" : "wallet"}
          {shippingUsd > 0 ? ` (includes $${shippingUsd.toFixed(2)} shipping)` : ""}. The buyer is
          notified on this Support thread — not Messages.
        </p>
      </div>

      {repairCreditTotal > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-950 dark:text-amber-100">
            ${repairCreditTotal.toFixed(2)} repair credit is already on this case. A full refund on
            top of that can double-pay the buyer.
          </p>
          <label className="flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowAfterCredit}
              onChange={(e) => setAllowAfterCredit(e.target.checked)}
            />
            I understand — refund the order anyway
          </label>
        </div>
      ) : null}

      {orderStatus === "confirmed" ? (
        <RadioGroup
          value={disposition}
          onValueChange={(value) => setDisposition(value as MarketplaceOrderRefundDisposition)}
          className="gap-1.5"
          disabled={pending}
        >
          {ADMIN_REFUND_DISPOSITION_OPTIONS.map((option) => {
            const id = `case-refund-${option.value}`
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer gap-2 rounded-md border px-2.5 py-2 text-xs",
                  disposition === option.value
                    ? "border-destructive/40 bg-background"
                    : "border-border/60",
                )}
              >
                <RadioGroupItem value={option.value} id={id} className="mt-0.5 shrink-0" />
                <span>
                  <Label htmlFor={id} className="cursor-pointer text-xs font-medium">
                    {option.label}
                  </Label>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
      ) : null}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={pending || needsCreditConfirm}
            className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {orderStatus === "refunding" ? "Sync refund from Stripe" : `Refund — ${selected.label}`}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {orderStatus === "refunding"
                ? "Sync refund status from Stripe?"
                : `Refund $${amount.toFixed(2)} on this case?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{selected.description}</span>
              <span className="block font-medium text-destructive">This cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
