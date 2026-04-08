"use client"

import { useCallback, useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  if (!publishableKey) return null
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

function StripePayButton({
  listingTitle,
  amountLabel,
  disabled,
}: {
  listingTitle: string
  amountLabel: string
  disabled: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)

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
          confirmParams: {
            return_url: `${origin}/checkout/success`,
          },
          redirect: "if_required",
        })

        if (error) {
          const hint =
            error.type === "invalid_request_error"
              ? " If this keeps happening, confirm your Stripe publishable and secret keys are from the same account and both test or both live."
              : ""
          toast.error((error.message ?? "Payment failed") + hint)
          return
        }

        if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
          const res = await fetch("/api/stripe/finalize-order", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
          })
          const data = (await res.json()) as { error?: string; orderId?: string }
          if (!res.ok) {
            toast.error(data.error ?? "Could not complete order")
            return
          }
          toast.success(`You bought “${listingTitle}”`)
          if (data.orderId) {
            router.replace(`/successpage/${data.orderId}`)
          } else {
            router.replace("/checkout/success")
          }
        }
      } catch (err) {
        console.error("Stripe checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, router, listingTitle],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {elementLoadError ? (
        <p className="text-sm text-destructive">{elementLoadError}</p>
      ) : null}
      <PaymentElement
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
        className="w-full gap-2"
        disabled={disabled || busy || !stripe || !!elementLoadError}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>Pay with card — {amountLabel}</>
        )}
      </Button>
    </form>
  )
}

export function StripeCardCheckout({
  listingId,
  listingTitle,
  price,
  fulfillment,
  shippingAddressId,
  purchaseDetailsReady = true,
  needsShipping = false,
}: {
  listingId: string
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
  purchaseDetailsReady?: boolean
  needsShipping?: boolean
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stripePromise = getStripeBrowser()

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
        const body: Record<string, unknown> = {
          listing_id: listingId,
          ...(fulfillment ? { fulfillment } : {}),
        }
        if (needsShipping && shippingAddressId) {
          body.address_id = shippingAddressId
        }
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as { clientSecret?: string; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? "Could not start card payment")
          return
        }
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
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
    listingId,
    fulfillment,
    price,
    shippingAddressId,
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

  const appearance =
    resolvedTheme === "dark"
      ? { theme: "night" as const, variables: { colorPrimary: "#fafafa" } }
      : { theme: "stripe" as const }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
      }}
    >
      <StripePayButton
        listingTitle={listingTitle}
        amountLabel={`$${price.toFixed(2)}`}
        disabled={false}
      />
    </Elements>
  )
}

export function stripeCardCheckoutEnabled(): boolean {
  return Boolean(publishableKey)
}
