"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { Appearance } from "@stripe/stripe-js"
import { useTheme } from "next-themes"
import { Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"
import { computeSellerLabelPrepaidAllowanceBreakdown } from "@/lib/shipping/seller-label-payment-breakdown"

function formatStripeConfirmError(error: unknown): string {
  if (error == null) return String(error)
  if (typeof error !== "object") return String(error)
  const o = error as Record<string, unknown>
  const msg = typeof o.message === "string" ? o.message.trim() : ""
  if (msg) return msg
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error as object))
  } catch {
    return Object.prototype.toString.call(error)
  }
}

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  const key = stripePublishableKey()
  if (!key) return null
  stripePromise ??= loadStripe(key)
  return stripePromise
}

type LabelCheckoutPayload = {
  rate_id: string
  seller_address_id?: string
  parcel?: {
    length_in: number
    width_in: number
    height_in: number
    weight_lb: number
  }
}

function LabelPaymentForm({
  orderId,
  clientSecret,
  amountLabel,
  onSuccess,
}: {
  orderId: string
  clientSecret: string
  amountLabel: string
  onSuccess: (data: {
    labelUrl: string | null
    trackingNumber: string
    orderDisplayNum: string
  }) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)

  const finalizePurchase = useCallback(
    async (paymentIntentId: string) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/shipping-label/finalize`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_intent_id: paymentIntentId }),
        },
      )
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          orderDisplayNum: string
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        toast.error(data.error ?? "Could not complete label purchase")
        return
      }
      onSuccess(data.data)
    },
    [orderId, onSuccess],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!stripe || !elements) return

      setBusy(true)
      try {
        const { error: submitError } = await elements.submit()
        if (submitError) {
          toast.error(submitError.message ?? "Check your payment details and try again.")
          return
        }

        const origin = window.location.origin
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${origin}/shipping?order=${encodeURIComponent(orderId)}`,
          },
          redirect: "if_required",
        })

        if (error) {
          console.error("Stripe confirmPayment error", formatStripeConfirmError(error), error)
          toast.error(error.message ?? "Payment could not be confirmed.")
          return
        }

        if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
          await finalizePurchase(paymentIntent.id)
        }
      } catch (err) {
        console.error("Seller label checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, clientSecret, orderId, finalizePurchase],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        Pay the full label cost with card when it exceeds the buyer&apos;s prepaid flat shipping amount.
      </p>
      {elementLoadError ? <p className="text-sm text-destructive">{elementLoadError}</p> : null}
      <PaymentElement
        options={{
          paymentMethodOrder: ["card", "link"],
          wallets: { applePay: "never", googlePay: "never" },
        }}
        onLoadError={(event) => {
          const msg =
            event.error?.message?.trim() ||
            "Payment form failed to load. Confirm Stripe keys are configured."
          setElementLoadError(msg)
          toast.error(msg)
        }}
      />
      <Button type="submit" disabled={busy || !stripe || !!elementLoadError}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing…
          </>
        ) : (
          <>
            <Printer className="h-4 w-4 mr-2" />
            Pay {amountLabel} &amp; print label
          </>
        )}
      </Button>
    </form>
  )
}

export function SellerShippingLabelCheckout({
  orderId,
  checkoutPayload,
  amountUsd,
  buyerPrepaidShippingUsd = 0,
  onSuccess,
}: {
  orderId: string
  checkoutPayload: LabelCheckoutPayload | null
  amountUsd: number
  buyerPrepaidShippingUsd?: number
  walletSpendableUsd?: number
  onSuccess: (data: {
    labelUrl: string | null
    trackingNumber: string
    orderDisplayNum: string
  }) => void
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const stripe = getStripeBrowser()

  const prepaidBreakdown = useMemo(
    () =>
      checkoutPayload && amountUsd >= 0.5
        ? computeSellerLabelPrepaidAllowanceBreakdown({
            labelCostUsd: amountUsd,
            buyerPrepaidAvailableUsd: buyerPrepaidShippingUsd,
          })
        : null,
    [checkoutPayload, amountUsd, buyerPrepaidShippingUsd],
  )

  const canPrintWithPrepaidAllowance = prepaidBreakdown?.canPurchaseWithPrepaidAllowance === true

  const needsCard = prepaidBreakdown != null && prepaidBreakdown.excessOverPrepaidUsd >= 0.5

  const purchaseWithPrepaidAllowance = useCallback(async () => {
    if (!checkoutPayload) return
    setWalletBusy(true)
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/shipping-label/wallet`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...checkoutPayload, apply_wallet: false }),
        },
      )
      const data = (await res.json()) as {
        data?: {
          labelUrl: string | null
          trackingNumber: string
          orderDisplayNum: string
        }
        error?: string
      }
      if (!res.ok || !data.data) {
        toast.error(data.error ?? "Could not purchase label")
        return
      }
      onSuccess(data.data)
    } catch {
      toast.error("Could not purchase label")
    } finally {
      setWalletBusy(false)
    }
  }, [checkoutPayload, orderId, onSuccess])

  const payloadKey = checkoutPayload
    ? JSON.stringify({
        rate_id: checkoutPayload.rate_id,
        seller_address_id: checkoutPayload.seller_address_id ?? "",
        parcel: checkoutPayload.parcel ?? null,
      })
    : ""

  useEffect(() => {
    if (!stripe || !checkoutPayload || !needsCard) {
      setClientSecret(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setClientSecret(null)
    setError(null)
    setLoading(true)

    ;(async () => {
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/shipping-label/payment-intent`,
          {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(checkoutPayload),
          },
        )
        const data = (await res.json()) as { data?: { clientSecret: string }; error?: string }
        if (cancelled) return
        if (!res.ok || !data.data?.clientSecret) {
          setError(data.error ?? "Could not start payment")
          return
        }
        setClientSecret(data.data.clientSecret)
      } catch {
        if (!cancelled) setError("Could not start payment")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderId, payloadKey, checkoutPayload, stripe, needsCard])

  if (!checkoutPayload) {
    return (
      <p className="text-sm text-muted-foreground">Select a carrier rate above to continue to payment.</p>
    )
  }

  const prepaidInfo =
    buyerPrepaidShippingUsd > 0 ? (
      <p className="text-sm text-muted-foreground rounded-lg border bg-muted/20 p-4">
        The buyer prepaid{" "}
        <span className="font-medium text-foreground tabular-nums">
          ${buyerPrepaidShippingUsd.toFixed(2)}
        </span>{" "}
        for flat shipping on this order.
        {prepaidBreakdown && prepaidBreakdown.shippingSurplusCreditUsd > 0
          ? ` If you choose a $${prepaidBreakdown.buyerPrepaidAppliedUsd.toFixed(2)} label, $${prepaidBreakdown.shippingSurplusCreditUsd.toFixed(2)} is credited to your wallet.`
          : null}
      </p>
    ) : null

  const storedValueSection = (
    <div className="space-y-3">
      {prepaidInfo}
      {canPrintWithPrepaidAllowance && prepaidBreakdown ? (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Pay ${prepaidBreakdown.buyerPrepaidAppliedUsd.toFixed(2)} from buyer prepaid shipping
            {prepaidBreakdown.shippingSurplusCreditUsd > 0
              ? ` — $${prepaidBreakdown.shippingSurplusCreditUsd.toFixed(2)} credited to your wallet`
              : ""}
            .
          </p>
          <Button type="button" disabled={walletBusy} onClick={() => void purchaseWithPrepaidAllowance()}>
            {walletBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Print label — ${prepaidBreakdown.buyerPrepaidAppliedUsd.toFixed(2)} from buyer shipping
              </>
            )}
          </Button>
        </div>
      ) : prepaidBreakdown && prepaidBreakdown.excessOverPrepaidUsd > 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border bg-muted/20 p-4">
          This label is ${prepaidBreakdown.labelCostUsd.toFixed(2)} — more than the $
          {buyerPrepaidShippingUsd.toFixed(2)} buyer prepaid for flat shipping. Pay the full label cost
          with card below or choose a cheaper rate.
        </p>
      ) : null}
    </div>
  )

  if (!stripe) {
    if (canPrintWithPrepaidAllowance) {
      return storedValueSection
    }
    return (
      <p className="text-sm text-muted-foreground">
        Card payments are not configured. Contact support if you need to purchase a label.
      </p>
    )
  }

  const appearance: Appearance =
    resolvedTheme === "dark"
      ? { theme: "night", variables: { colorPrimary: "#fafafa" } }
      : {
          theme: "stripe",
          variables: {
            colorPrimary: BRAND_CTA_BLUE,
            borderRadius: "6px",
          },
        }

  return (
    <div className="space-y-4">
      {storedValueSection}
      {needsCard ? (
        <>
          {canPrintWithPrepaidAllowance ? (
            <p className="text-sm font-medium text-muted-foreground">Or pay full label cost with card</p>
          ) : null}
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing secure checkout…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !clientSecret ? (
            <p className="text-sm text-muted-foreground">Payment is unavailable for this rate.</p>
          ) : (
            <Elements key={clientSecret} stripe={stripe} options={{ clientSecret, appearance }}>
              <LabelPaymentForm
                orderId={orderId}
                clientSecret={clientSecret}
                amountLabel={`$${amountUsd.toFixed(2)}`}
                onSuccess={onSuccess}
              />
            </Elements>
          )}
        </>
      ) : null}
    </div>
  )
}
