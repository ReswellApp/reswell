"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import {
  ADMIN_REFUND_DISPOSITION_OPTIONS,
  DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION,
  type MarketplaceOrderRefundDisposition,
} from "@/lib/services/marketplaceOrderRefundDisposition"
import { cn } from "@/lib/utils"

type RefundApiResponse =
  | {
      success: true
      refund_type: "stripe" | "wallet"
      disposition?: MarketplaceOrderRefundDisposition
      message: string
      fullyRefundedInApp: boolean
      alreadyProcessedInStripe?: boolean
    }
  | { error: string }

/**
 * Full-admin refund for a marketplace order with selectable post-refund dispositions.
 * Disposition options are shown inline on the order page so admins can pick before confirming.
 */
export function AdminIssueRefundButton({
  orderId,
  orderStatus,
  amount,
  paymentMethod,
  onComplete,
}: {
  orderId: string
  orderStatus: string
  amount: number
  paymentMethod: string
  /** Called after a successful refund (client pages should refetch order data). */
  onComplete?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [fullyRefundedUi, setFullyRefundedUi] = useState(false)
  const [disposition, setDisposition] = useState<MarketplaceOrderRefundDisposition>(
    DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION,
  )

  if (orderStatus !== "confirmed" && orderStatus !== "refunding") return null

  if (fullyRefundedUi) {
    return (
      <Button type="button" variant="outline" disabled className="gap-2 border-muted text-muted-foreground">
        Already refunded
      </Button>
    )
  }

  const isSyncOnly = orderStatus === "refunding"
  const isCard = paymentMethod === "stripe"
  const refundTarget = isCard ? "the buyer's card" : "the buyer's wallet balance"
  const selectedOption =
    ADMIN_REFUND_DISPOSITION_OPTIONS.find((o) => o.value === disposition) ??
    ADMIN_REFUND_DISPOSITION_OPTIONS[0]!

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: isSyncOnly ? undefined : { "Content-Type": "application/json" },
        body: isSyncOnly ? undefined : JSON.stringify({ disposition }),
      })
      const data = (await res.json()) as RefundApiResponse
      if (!res.ok || !("success" in data) || !data.success) {
        toast.error("error" in data ? data.error : "Could not issue refund")
        return
      }
      if (data.fullyRefundedInApp) {
        setFullyRefundedUi(true)
      }
      toast.success(data.message)
      setOpen(false)
      onComplete?.()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  if (isSyncOnly) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            disabled={busy}
            className="gap-2 border-amber-500/30 text-amber-950 dark:text-amber-100 hover:bg-amber-500/10"
          >
            <RotateCcw className="h-4 w-4" />
            Sync refund from Stripe
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync refund status from Stripe?</AlertDialogTitle>
            <AlertDialogDescription>
              Fetches the latest refund state from Stripe and updates this order (for example after a
              Dashboard refund or when a pending refund has just completed). No new refund is created if
              one already exists. Listing side effects follow the disposition saved when the refund was
              started.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync from Stripe
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Refund type</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All options refund ${amount.toFixed(2)} to {refundTarget} and reverse seller earnings. None buy
          a return shipping label — use Item returns above only when a physical return is needed.
        </p>
      </div>

      <RadioGroup
        value={disposition}
        onValueChange={(value) => setDisposition(value as MarketplaceOrderRefundDisposition)}
        className="gap-2"
        disabled={busy}
      >
        {ADMIN_REFUND_DISPOSITION_OPTIONS.map((option) => {
          const id = `refund-disposition-${option.value}`
          const selected = disposition === option.value
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                selected
                  ? "border-destructive/40 bg-destructive/[0.04]"
                  : "border-border/70 hover:bg-muted/40",
              )}
            >
              <RadioGroupItem value={option.value} id={id} className="mt-0.5 shrink-0" />
              <span className="min-w-0 space-y-1">
                <Label htmlFor={id} className="cursor-pointer font-medium text-foreground">
                  {option.label}
                </Label>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
                <span className="block text-xs text-muted-foreground/90">
                  Use when: {option.recommendedWhen}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            disabled={busy}
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            Issue refund — {selectedOption.label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Refund ${amount.toFixed(2)} ({selectedOption.label})?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Refunds ${amount.toFixed(2)} to {refundTarget} and reverses seller earnings.
              </span>
              <span className="block text-foreground">
                {selectedOption.description}
              </span>
              <span className="block font-medium text-destructive">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm refund
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
