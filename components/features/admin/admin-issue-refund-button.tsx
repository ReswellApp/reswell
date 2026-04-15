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
import { Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"

type RefundApiResponse =
  | {
      success: true
      refund_type: "stripe" | "wallet"
      message: string
      alreadyProcessedInStripe?: boolean
    }
  | { error: string }

/**
 * Full-admin refund for a marketplace order (same server logic as seller refund, different auth).
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

  if (orderStatus !== "confirmed") return null

  const isCard = paymentMethod === "stripe"
  const refundTarget = isCard ? "the buyer's card" : "the buyer's Reswell Bucks balance"

  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
      })
      const data = (await res.json()) as RefundApiResponse
      if (!res.ok || !("success" in data) || !data.success) {
        toast.error("error" in data ? data.error : "Could not issue refund")
        return
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

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <RotateCcw className="h-4 w-4" />
          Issue refund (admin)
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund ${amount.toFixed(2)} to the buyer?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This runs the same full refund as the seller: ${amount.toFixed(2)} to {refundTarget}, seller
              earnings reversed, payouts cancelled where applicable, and the listing re-listed if sold.
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
  )
}
