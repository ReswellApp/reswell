"use client"

import { useCallback, useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import type { Appearance, StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"
import { buildOrderSuccessPath } from "@/lib/google-ads/purchase-success-path"
import { cn } from "@/lib/utils"

const publishableKey = stripePublishableKey()

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

/** Start loading Stripe.js from the CDN before the payment form mounts. */
export function prefetchStripeJs(): void {
  void getStripeBrowser()
}

/**
 * One `<Elements>` tree: Express Checkout (Link, Apple Pay, Google Pay) + Payment Element (card, Klarna).
 * Wallets stay off on the Payment Element so they are not duplicated. Do not mount a second
 * `<Elements>` provider for the same client secret — that breaks `confirmPayment` for wallets.
 */
function CheckoutForm({
  clientSecret,
  amountLabel,
  disabled,
  submitButtonLabel,
  submitButtonClassName,
  buyerEmail,
}: {
  clientSecret: string
  amountLabel: string
  disabled: boolean
  submitButtonLabel?: string
  submitButtonClassName?: string
  buyerEmail?: string | null
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)
  const [expressVisible, setExpressVisible] = useState(false)

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
        router.replace(buildOrderSuccessPath(data.orderId, { reportPurchase: true }))
      } else {
        router.replace("/checkout/success")
      }
    },
    [router],
  )

  const confirmAndComplete = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!stripe || !elements) {
      return { ok: false, message: "Payment is still loading. Try again." }
    }

    const { error: submitError } = await elements.submit()
    if (submitError) {
      return { ok: false, message: submitError.message ?? "Check your payment details and try again." }
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
      return { ok: false, message: userMsg }
    }

    if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
      await completeAfterSuccess(paymentIntent.id)
    }

    return { ok: true }
  }, [stripe, elements, clientSecret, completeAfterSuccess])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!stripe || !elements) return

      setBusy(true)
      try {
        const result = await confirmAndComplete()
        if (!result.ok) toast.error(result.message)
      } catch (err) {
        console.error("Stripe checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, confirmAndComplete],
  )

  const handleExpressConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) {
        event.paymentFailed({ reason: "fail" })
        return
      }

      setBusy(true)
      try {
        const result = await confirmAndComplete()
        if (!result.ok) {
          event.paymentFailed({ reason: "fail", message: result.message })
          toast.error(result.message)
        }
      } catch (err) {
        console.error("Stripe express checkout error", err)
        event.paymentFailed({ reason: "fail" })
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, confirmAndComplete],
  )

  const billingEmail = buyerEmail?.trim() || undefined

  return (
    <div className="space-y-4">
      {elementLoadError ? (
        <p className="text-sm text-destructive">{elementLoadError}</p>
      ) : null}

      <div className={cn(busy && "pointer-events-none opacity-60")}>
        <ExpressCheckoutElement
          options={{
            business: { name: "Reswell" },
            paymentMethodOrder: ["apple_pay", "google_pay", "link"],
            paymentMethods: {
              applePay: "always",
              googlePay: "always",
              link: "auto",
              paypal: "never",
              amazonPay: "never",
              klarna: "never",
            },
            buttonType: { applePay: "buy", googlePay: "buy" },
            layout: { maxColumns: 2, maxRows: 2, overflow: "auto" },
          }}
          onReady={(event) => {
            const methods = event.availablePaymentMethods
            setExpressVisible(
              Boolean(methods && (methods.applePay || methods.googlePay || methods.link)),
            )
          }}
          onConfirm={(event) => {
            void handleExpressConfirm(event)
          }}
          onLoadError={(event) => {
            setExpressVisible(false)
            console.error("Stripe ExpressCheckoutElement load error", {
              code: event.error?.code,
              message: event.error?.message,
              type: event.error?.type,
            })
          }}
        />
      </div>

      {expressVisible ? (
        <div className="flex items-center gap-3" role="separator" aria-label="or pay another way">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[12px] text-neutral-500">or</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement
          key="stripe-payment-element"
          options={{
            paymentMethodOrder: ["link", "card", "klarna"],
            wallets: { applePay: "never", googlePay: "never" },
            ...(billingEmail
              ? { defaultValues: { billingDetails: { email: billingEmail } } }
              : {}),
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
  promoCode,
  shippingQuoteToken,
  purchaseDetailsReady = true,
  needsShipping = false,
  submitButtonLabel,
  submitButtonClassName,
  buyerEmail,
}: {
  listingIds: string[]
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
  offerId?: string | null
  promoCode?: string | null
  shippingQuoteToken?: string | null
  purchaseDetailsReady?: boolean
  needsShipping?: boolean
  /** When set, replaces the default “Pay — $x” label. */
  submitButtonLabel?: string
  submitButtonClassName?: string
  /** Prefills Link / billing email when the buyer is signed in. */
  buyerEmail?: string | null
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [chargedTotalUsd, setChargedTotalUsd] = useState<number | null>(null)
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
    setChargedTotalUsd(null)
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
            ...(promoCode ? { promo_code: promoCode } : {}),
            ...(shippingQuoteToken ? { quote_token: shippingQuoteToken } : {}),
          }),
        })
        const data = (await res.json()) as {
          clientSecret?: string
          error?: string
          shippingUsd?: number
          totalUsd?: number
        }
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
          if (typeof data.totalUsd === "number" && Number.isFinite(data.totalUsd) && data.totalUsd > 0) {
            setChargedTotalUsd(data.totalUsd)
          }
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
    promoCode,
    shippingQuoteToken,
    purchaseDetailsReady,
    needsShipping,
    stripePromise,
  ])

  if (!purchaseDetailsReady) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Complete purchase details above to continue to payment.
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border bg-card text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading secure checkout…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[100px] flex-col items-start justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="flex min-h-[100px] flex-col items-start justify-center">
        <p className="text-sm text-muted-foreground">Payment is unavailable.</p>
      </div>
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
      <CheckoutForm
        clientSecret={clientSecret}
        amountLabel={`$${(chargedTotalUsd ?? price).toFixed(2)}`}
        disabled={false}
        submitButtonLabel={submitButtonLabel}
        submitButtonClassName={submitButtonClassName}
        buyerEmail={buyerEmail}
      />
    </Elements>
  )
}
