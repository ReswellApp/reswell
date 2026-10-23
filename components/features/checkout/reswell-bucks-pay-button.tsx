"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buildOrderSuccessPath } from "@/lib/google-ads/purchase-success-path"
import { cn } from "@/lib/utils"

interface ReswellBucksPayButtonProps {
  listingIds: string[]
  price: number
  spendableUsd: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
  offerId?: string | null
  promoCode?: string | null
  shippingQuoteToken?: string | null
  packagingMode?: "together" | "separate" | null
  disabled?: boolean
  className?: string
}

function idempotencyKey(parts: string): string {
  const storageKey = `reswell-bucks-checkout:${parts}`
  try {
    const existing = sessionStorage.getItem(storageKey)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(storageKey, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function ReswellBucksPayButton({
  listingIds,
  price,
  spendableUsd,
  fulfillment,
  shippingAddressId,
  offerId,
  promoCode,
  shippingQuoteToken,
  packagingMode,
  disabled = false,
  className,
}: ReswellBucksPayButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const shortfall = Math.round((price - spendableUsd) * 100) / 100
  const canPay = shortfall <= 0 && price > 0

  async function pay(): Promise<void> {
    if (!canPay || busy) return
    setBusy(true)
    try {
      const key = idempotencyKey(
        [
          listingIds.join(","),
          fulfillment ?? "",
          shippingAddressId ?? "",
          Math.round(price * 100).toString(),
          promoCode ?? "",
          packagingMode ?? "",
          offerId ?? "",
        ].join("|"),
      )
      const res = await fetch("/api/wallet/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: key,
          listing_ids: listingIds,
          fulfillment: fulfillment ?? null,
          address_id: shippingAddressId ?? null,
          offer_id: offerId ?? null,
          promo_code: promoCode ?? null,
          quote_token: shippingQuoteToken ?? null,
          packaging_mode: packagingMode ?? null,
        }),
      })
      const body = (await res.json()) as {
        error?: string | { formErrors?: string[] }
        data?: { orderId?: string }
      }
      if (!res.ok) {
        const message = typeof body.error === "string" ? body.error : "Could not pay with Reswell Bucks."
        toast.error(message)
        return
      }
      const orderId = body.data?.orderId
      if (!orderId) {
        toast.error("Could not pay with Reswell Bucks.")
        return
      }
      router.replace(buildOrderSuccessPath(orderId, { reportPurchase: true }))
    } catch {
      toast.error("Could not pay with Reswell Bucks.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={disabled || busy || !canPay}
        className={cn(className)}
        onClick={() => void pay()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {canPay ? `Pay $${price.toFixed(2)} with Reswell Bucks` : "Reswell Bucks balance is short"}
      </Button>
      <p className="text-center text-[12px] text-neutral-500">
        Admin pilot. Available ${spendableUsd.toFixed(2)}.
        {canPay
          ? " The seller is credited pending earnings. Fee and shipping stay on the internal ledger."
          : ` Add $${shortfall.toFixed(2)} or pay with card.`}
      </p>
    </div>
  )
}
