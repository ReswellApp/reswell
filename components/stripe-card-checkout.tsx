"use client"

import { useCallback, useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  PaymentRequestButtonElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js"
import type { PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js"
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
 * Apple Pay only (Payment Request API). `disableWallets` hides Google Pay, Link, and browser cards in this row.
 * Still needs HTTPS and a [registered payment-method domain](https://dashboard.stripe.com/settings/payment_method_domains) for production.
 */
function WalletPaymentRequestButton({
  clientSecret,
  totalCents,
  listingTitle,
  disabled,
  onBusy,
  onComplete,
}: {
  clientSecret: string
  totalCents: number
  listingTitle: string
  disabled: boolean
  onBusy: (busy: boolean) => void
  onComplete: (paymentIntentId: string) => Promise<void>
}) {
  const stripe = useStripe()
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)
  const [canUseWallet, setCanUseWallet] = useState<boolean | null>(null)

  useEffect(() => {
    if (!stripe) return
    setPaymentRequest(null)
    setCanUseWallet(null)

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: listingTitle.slice(0, 100) || "Reswell order",
        amount: totalCents,
      },
      requestPayerName: true,
      requestPayerEmail: true,
      disableWallets: ["googlePay", "link", "browserCard"],
    })

    const onPayment = async (ev: PaymentRequestPaymentMethodEvent) => {
      onBusy(true)
      try {
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false },
        )

        if (confirmError) {
          ev.complete("fail")
          toast.error(confirmError.message ?? "Could not complete wallet payment")
          return
        }

        ev.complete("success")

        if (paymentIntent?.status === "requires_action") {
          const { error: actErr, paymentIntent: after } = await stripe.confirmCardPayment(clientSecret)
          if (actErr) {
            toast.error(actErr.message ?? "Could not complete authentication")
            return
          }
          if (after?.status === "succeeded" && after.id) {
            await onComplete(after.id)
          }
        } else if (paymentIntent?.status === "succeeded" && paymentIntent.id) {
          await onComplete(paymentIntent.id)
        }
      } catch (err) {
        console.error("Wallet payment error", err)
        try {
          ev.complete("fail")
        } catch {
          // ignore
        }
        toast.error("Wallet payment could not be completed. Try a card below.")
      } finally {
        onBusy(false)
      }
    }

    pr.on("paymentmethod", onPayment)

    void pr.canMakePayment().then((result) => {
      if (typeof window !== "undefined") {
        console.info("[ApplePay] canMakePayment =", result)
      }
      if (result && (result as Record<string, boolean>).applePay) {
        setPaymentRequest(pr)
        setCanUseWallet(true)
      } else {
        setCanUseWallet(false)
      }
    })

    return () => {
      pr.off("paymentmethod", onPayment)
    }
  }, [stripe, clientSecret, totalCents, listingTitle, onBusy, onComplete])

  if (disabled) {
    return null
  }

  if (canUseWallet === false || canUseWallet === null) {
    return null
  }

  if (!paymentRequest) {
    return null
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Apple Pay</p>
        <div className="w-full min-h-12">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: "buy",
                  theme: "light",
                  height: "48px",
                },
              },
            }}
          />
        </div>
        <p className="text-[11px] text-neutral-400">
          Same order total as below. Works in Safari and on iPhone; add a card in Apple Wallet, use HTTPS, and add your
          domain under Stripe (Payment method domains).
        </p>
      </div>
      <div className="flex items-center gap-2 py-1">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-[12px] text-neutral-500">or pay another way</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
    </>
  )
}

function StripePayButton({
  clientSecret,
  listingTitle,
  amountLabel,
  totalCents,
  disabled,
  submitButtonLabel,
  submitButtonClassName,
}: {
  clientSecret: string
  listingTitle: string
  amountLabel: string
  totalCents: number
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
      toast.success(`You bought “${listingTitle}”`)
      if (data.orderId) {
        router.replace(`/successpage/${data.orderId}`)
      } else {
        router.replace("/checkout/success")
      }
    },
    [router, listingTitle],
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
    [stripe, elements, completeAfterSuccess],
  )

  return (
    <div className="space-y-4">
      {elementLoadError ? (
        <p className="text-sm text-destructive">{elementLoadError}</p>
      ) : null}

      <WalletPaymentRequestButton
        clientSecret={clientSecret}
        totalCents={totalCents}
        listingTitle={listingTitle}
        disabled={disabled || busy || !stripe || !!elementLoadError}
        onBusy={setBusy}
        onComplete={completeAfterSuccess}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement
          options={{
            paymentMethodOrder: ["card", "klarna", "link"],
            wallets: { applePay: "auto", googlePay: "never" },
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
  listingId,
  listingTitle,
  price,
  fulfillment,
  shippingAddressId,
  purchaseDetailsReady = true,
  needsShipping = false,
  submitButtonLabel,
  submitButtonClassName,
}: {
  listingId: string
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
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
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            listing_id: listingId,
            ...(fulfillment ? { fulfillment } : {}),
            ...(needsShipping && shippingAddressId ? { address_id: shippingAddressId } : {}),
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
      : {
          theme: "stripe" as const,
          variables: {
            colorPrimary: BRAND_CTA_BLUE,
            borderRadius: "6px",
          },
        }

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
        clientSecret={clientSecret}
        listingTitle={listingTitle}
        amountLabel={`$${price.toFixed(2)}`}
        totalCents={Math.round(price * 100)}
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
