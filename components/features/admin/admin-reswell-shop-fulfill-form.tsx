"use client"

import { useState } from "react"
import { Loader2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface AdminReswellShopFulfillFormProps {
  orderId: string
  onFulfilled?: () => void
  className?: string
}

/**
 * One-click Reswell shop fulfill: buy ShipEngine label from product package dims,
 * attach tracking, mark shipped, and fire Klaviyo Order Shipped.
 */
export function AdminReswellShopFulfillForm({
  orderId,
  onFulfilled,
  className,
}: AdminReswellShopFulfillFormProps) {
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/shop/orders/${encodeURIComponent(orderId)}/fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      )
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: {
          trackingNumber?: string
          trackingCarrier?: string | null
          alreadyPurchased?: boolean
        }
      }
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Could not buy label")
        return
      }
      const tn = body.data?.trackingNumber?.trim()
      toast.success(
        tn
          ? `Label purchased — tracking ${tn}. Buyer notified (Order Shipped).`
          : "Label purchased and order marked shipped",
      )
      onFulfilled?.()
    } catch {
      toast.error("Could not buy label")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <Truck className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Buy label & ship
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Purchases a ShipEngine label using this product&apos;s packed package size, saves
              tracking immediately, marks the order shipped, and sends Klaviyo Order Shipped.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          {busy ? "Buying label…" : "Buy ShipEngine label & mark shipped"}
        </Button>
      </div>
    </div>
  )
}
