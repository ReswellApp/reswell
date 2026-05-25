"use client"

import { useCallback, useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { Appearance } from "@stripe/stripe-js"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""

/** Stripe.js errors sometimes omit enumerable fields; devtools then show `{}` for plain object logs. */
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
  if (!publishableKey) return null
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

/**
 * Single Payment Element (card, Link, Klarna). Wallets: Apple Pay and Google Pay are hidden in the
 * element (`wallets.*: "never"`) until we re-enable; flip `applePay` to `"auto"` to show it again.
 * Server-side payment intent, `confirmPayment`, and finalize flow are unchanged.
 * We do not mount a separate Express Checkout Element: two `<Elements>` trees for the same client secret
 * can break `confirmPayment` for wallets.
 */
function CheckoutForm({
  clientSecret,
  amountLabel,
  disabled,
  submitButtonLabel,
  submitButtonClassName,
}: {
  clientSecret: string
  amountLabel: string
  disabled: boolean
  submitButtonLabel?: string
  submitButtonClassName?: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)

  const completeAfterSuccess = useCallback(
    async (paymentIntentId: string) => {
      const res = await fetch("/api/stripe/finalize-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      })
      const data = (await res.json()) as { error?: string; orderId?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not complete order")
        return
      }
      if (data.orderId) {
        router.replace(`/successpage/${data.orderId}`)
      } else {
        router.replace("/checkout/success")
      }
    },
    [router],
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
            return_url: `${origin}/checkout/success`,
          },
          redirect: "if_required",
        })

        if (error) {
          const detail = formatStripeConfirmError(error)
          console.error("Stripe confirmPayment error", detail, error)
          const userMsg =
            (typeof error.message === "string" && error.message.trim()) ||
            "Payment could not be confirmed. If this persists, confirm your Stripe publishable and secret keys are both test or both live from the same Stripe account (then redeploy so the publishable key matches the server)."
          toast.error(userMsg)
          return
        }

        if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
          await completeAfterSuccess(paymentIntent.id)
        }
      } catch (err) {
        console.error("Stripe checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, clientSecret, completeAfterSuccess],
  )

  return (
    <div className="space-y-4">
      {elementLoadError ? (
        <p className="text-sm text-destructive">{elementLoadError}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement
          key="stripe-payment-element"
          options={{
            paymentMethodOrder: ["card", "klarna", "link"],
            // Hide wallet buttons in PE until ready; re-enable with applePay: "auto" (and optionally googlePay).
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onLoadError={(event) => {
            const stripeErr = event.error
            const msg =
              stripeErr?.message?.trim() ||
              "Payment form failed to load. Use Stripe keys from the same account and the same mode (test vs live) for the publishable key and server secret."
            setElementLoadError(msg)
            console.error("Stripe PaymentElement load error", {
              code: stripeErr?.code,
              message: stripeErr?.message,
              type: stripeErr?.type,
            })
            toast.error(msg)
          }}
        />
        <Button
          type="submit"
          size="lg"
          className={submitButtonClassName ?? "w-full gap-2"}
          disabled={disabled || busy || !stripe || !!elementLoadError}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>{submitButtonLabel ?? `Pay — ${amountLabel}`}</>
          )}
        </Button>
      </form>
    </div>
  )
}

export function StripeCardCheckout({
  listingIds,
  listingTitle,
  price,
  fulfillment,
  shippingAddressId,
  offerId,
  purchaseDetailsReady = true,
  needsShipping = false,
  submitButtonLabel,
  submitButtonClassName,
}: {
  listingIds: string[]
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
  offerId?: string | null
  purchaseDetailsReady?: boolean
  needsShipping?: boolean
  /** When set, replaces the default “Pay — $x” label. */
  submitButtonLabel?: string
  submitButtonClassName?: string
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stripePromise = getStripeBrowser()

  const listingIdsKey = [...listingIds].sort().join("|")

  useEffect(() => {
    if (!stripePromise) {
      setLoading(false)
      return
    }

    if (!purchaseDetailsReady) {
      setClientSecret(null)
      setError(null)
      setLoading(false)
      return
    }

    if (!listingIds.length) {
      setClientSecret(null)
      setError(null)
      setLoading(false)
      return
    }

    if (needsShipping && !shippingAddressId) {
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
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            listing_ids: listingIds,
            ...(fulfillment ? { fulfillment } : {}),
            ...(needsShipping && shippingAddressId ? { address_id: shippingAddressId } : {}),
            ...(offerId ? { offer_id: offerId } : {}),
          }),
        })
        const data = (await res.json()) as { clientSecret?: string; error?: string }
        if (cancelled) return
        if (!res.ok) {
          console.error("[StripeCardCheckout] create-payment-intent failed", {
            status: res.status,
            error: data.error,
          })
          setError(data.error ?? "Could not start card payment")
          return
        }
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          console.error("[StripeCardCheckout] no clientSecret in response", data)
          setError("Could not start card payment — no client secret returned")
        }
      } catch {
        if (!cancelled) setError("Could not start card payment")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    listingIdsKey,
    fulfillment,
    price,
    shippingAddressId,
    offerId,
    purchaseDetailsReady,
    needsShipping,
    stripePromise,
  ])

  if (!purchaseDetailsReady) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Complete purchase details above to pay with your card.
      </div>
    )
  }

  if (needsShipping && !shippingAddressId) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Save a shipping address above to continue to payment.
      </div>
    )
  }

  if (!stripePromise) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border bg-card py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading secure checkout…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!clientSecret) {
    return <p className="text-sm text-muted-foreground">Card payment is unavailable.</p>
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
      <CheckoutForm
        clientSecret={clientSecret}
        amountLabel={`$${price.toFixed(2)}`}
        disabled={false}
        submitButtonLabel={submitButtonLabel}
        submitButtonClassName={submitButtonClassName}
      />
    </Elements>
  )
}

export function stripeCardCheckoutEnabled(): boolean {
  return Boolean(publishableKey)
}
