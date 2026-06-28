"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { Appearance } from "@stripe/stripe-js"
import { useTheme } from "next-themes"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"

const publishableKey = stripePublishableKey()

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  if (!publishableKey) return null
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

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

type CheckoutPayload =
  | { listingId: string; buyerId: string }
  | {
      listingId: string
      customer: {
        firstName: string
        lastName?: string
        email: string
        phone?: string
      }
    }

function AdminTerminalCheckoutForm({
  clientSecret,
  amountLabel,
  onOrderConfirmed,
}: {
  clientSecret: string
  amountLabel: string
  onOrderConfirmed: (orderId: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!stripe || !elements) return

      setBusy(true)
      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        })

        if (error) {
          toast.error(formatStripeConfirmError(error))
          return
        }

        const piId = paymentIntent?.id
        if (!piId || paymentIntent.status !== "succeeded") {
          toast.error("Payment did not complete")
          return
        }

        const res = await fetch("/api/admin/terminal/sale/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: piId }),
        })
        const json = (await res.json()) as { data?: { orderId?: string }; error?: string }
        if (!res.ok || !json.data?.orderId) {
          toast.error(json.error ?? "Payment succeeded but order settlement failed")
          return
        }

        onOrderConfirmed(json.data.orderId)
      } catch {
        toast.error("Could not complete payment")
      } finally {
        setBusy(false)
      }
    },
    [elements, onOrderConfirmed, stripe],
  )

  return (
    <div className="space-y-4">
      {elementLoadError ? (
        <p className="text-sm text-destructive">{elementLoadError}</p>
      ) : null}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <PaymentElement
          options={{
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onLoadError={(event) => {
            const msg =
              event.error?.message?.trim() ||
              "Payment form failed to load. Check Stripe keys are from the same account and mode."
            setElementLoadError(msg)
            toast.error(msg)
          }}
        />
        <Button type="submit" size="lg" className="w-full gap-2" disabled={busy || !stripe || !!elementLoadError}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>Pay — {amountLabel}</>
          )}
        </Button>
      </form>
    </div>
  )
}

export function AdminTerminalCardCheckout({
  listingId,
  amountUsd,
  checkoutPayload,
  disabled,
  onOrderConfirmed,
}: {
  listingId: string
  amountUsd: number
  checkoutPayload: CheckoutPayload | null
  disabled?: boolean
  onOrderConfirmed: (orderId: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stripePromise = getStripeBrowser()
  const payloadKey = useMemo(() => JSON.stringify(checkoutPayload ?? {}), [checkoutPayload])

  useEffect(() => {
    if (!stripePromise || disabled || !checkoutPayload) {
      setClientSecret(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setClientSecret(null)
    setError(null)
    setLoading(true)

    void fetch("/api/admin/terminal/sale/checkout-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    })
      .then(async (res) => {
        const json = (await res.json()) as {
          data?: { clientSecret?: string }
          error?: string
        }
        if (cancelled) return
        if (!res.ok || !json.data?.clientSecret) {
          setError(json.error ?? "Could not start card checkout")
          return
        }
        setClientSecret(json.data.clientSecret)
      })
      .catch(() => {
        if (!cancelled) setError("Could not start card checkout")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [checkoutPayload, disabled, listingId, payloadKey, stripePromise])

  if (!stripePromise) {
    return (
      <p className="text-sm text-muted-foreground">
        Card checkout is unavailable — Stripe publishable key is not configured.
      </p>
    )
  }

  if (!checkoutPayload) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Complete customer details above to pay by card.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border bg-card text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading secure checkout…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!clientSecret) {
    return (
      <p className="text-sm text-muted-foreground">Card checkout is unavailable for this listing.</p>
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
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance }}>
      <AdminTerminalCheckoutForm
        clientSecret={clientSecret}
        amountLabel={`$${amountUsd.toFixed(2)}`}
        onOrderConfirmed={onOrderConfirmed}
      />
    </Elements>
  )
}
