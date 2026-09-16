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
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"
import { cn } from "@/lib/utils"

const publishableKey = stripePublishableKey()

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  if (!publishableKey) return null
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

function formatStripeConfirmError(error: unknown): string {
  if (error == null) return "Payment could not be reserved."
  if (typeof error !== "object") return String(error)
  const msg = typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message.trim()
    : ""
  return msg || "Payment could not be reserved. Try another card."
}

function OfferPaymentForm({
  clientSecret,
  totalUsd,
  disabled,
  onAuthorized,
}: {
  clientSecret: string
  totalUsd: number
  disabled: boolean
  onAuthorized: (paymentIntentId: string) => Promise<void>
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)
  const [expressVisible, setExpressVisible] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const confirmReservation = useCallback(async (): Promise<
    { ok: true; paymentIntentId: string } | { ok: false; message: string }
  > => {
    if (!stripe || !elements) {
      return { ok: false, message: "Payment is still loading. Try again." }
    }

    const { error: submitError } = await elements.submit()
    if (submitError) {
      return { ok: false, message: submitError.message ?? "Check your payment details and try again." }
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/offers`,
      },
      redirect: "if_required",
    })

    if (error) {
      return { ok: false, message: formatStripeConfirmError(error) }
    }

    if (paymentIntent?.status === "requires_capture" && paymentIntent.id) {
      return { ok: true, paymentIntentId: paymentIntent.id }
    }

    return { ok: false, message: "Could not reserve this payment. Try another card." }
  }, [clientSecret, elements, stripe])

  const runConfirm = useCallback(async () => {
    setFormError(null)
    setBusy(true)
    try {
      const result = await confirmReservation()
      if (!result.ok) {
        setFormError(result.message)
        return { ok: false as const, message: result.message }
      }
      await onAuthorized(result.paymentIntentId)
      return { ok: true as const }
    } finally {
      setBusy(false)
    }
  }, [confirmReservation, onAuthorized])

  return (
    <div className="space-y-3">
      {elementLoadError ? <p className="text-sm text-destructive">{elementLoadError}</p> : null}
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
            buttonType: { applePay: "plain", googlePay: "plain" },
            layout: { maxColumns: 2, maxRows: 2, overflow: "auto" },
          }}
          onReady={(event) => {
            const methods = event.availablePaymentMethods
            setExpressVisible(Boolean(methods && (methods.applePay || methods.googlePay || methods.link)))
          }}
          onConfirm={(event: StripeExpressCheckoutElementConfirmEvent) => {
            void (async () => {
              const result = await runConfirm()
              if (!result.ok) {
                event.paymentFailed({ reason: "fail", message: result.message })
              }
            })()
          }}
          onLoadError={() => setExpressVisible(false)}
        />
      </div>
      {expressVisible ? (
        <div className="flex items-center gap-3" role="separator" aria-label="or pay another way">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[12px] text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void runConfirm()
        }}
        className="space-y-3"
      >
        <PaymentElement
          options={{
            paymentMethodOrder: ["link", "card"],
            wallets: { applePay: "never", googlePay: "never" },
          }}
          onLoadError={(event) => {
            const msg =
              event.error?.message?.trim() ||
              "Payment form failed to load. Try again or use another card."
            setElementLoadError(msg)
          }}
        />
        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={disabled || busy || !stripe || !!elementLoadError}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Reserving…
            </>
          ) : (
            `Send offer — reserve $${totalUsd.toFixed(2)}`
          )}
        </Button>
      </form>
    </div>
  )
}

export function OfferPaymentStep({
  listingId,
  amount,
  fulfillment,
  addressId,
  quoteToken,
  disabled,
  onAuthorized,
}: {
  listingId: string
  amount: number
  fulfillment: "pickup" | "shipping"
  addressId: string | null
  quoteToken: string | null
  disabled: boolean
  onAuthorized: (paymentIntentId: string) => Promise<void>
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [totalUsd, setTotalUsd] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stripeBrowser = getStripeBrowser()

  useEffect(() => {
    if (!stripeBrowser) {
      setLoading(false)
      setError("Card payments are not configured.")
      return
    }
    if (fulfillment === "shipping" && !addressId) {
      setLoading(false)
      setError("Add a shipping address before reserving payment.")
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setClientSecret(null)

    void (async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/offer-payment-intent`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount,
            fulfillment,
            ...(addressId ? { address_id: addressId } : {}),
            ...(quoteToken ? { quote_token: quoteToken } : {}),
          }),
        })
        const json = (await res.json()) as {
          error?: string
          data?: { clientSecret?: string; totalUsd?: number }
        }
        if (cancelled) return
        if (!res.ok || !json.data?.clientSecret) {
          setError(json.error?.trim() || "Could not start the payment reservation.")
          return
        }
        setClientSecret(json.data.clientSecret)
        if (typeof json.data.totalUsd === "number") {
          setTotalUsd(json.data.totalUsd)
        }
      } catch {
        if (!cancelled) setError("Could not start the payment reservation.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [addressId, amount, fulfillment, listingId, quoteToken, stripeBrowser])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Preparing payment…
      </div>
    )
  }

  if (error || !clientSecret || totalUsd == null) {
    return <p className="text-sm text-destructive">{error || "Could not start the payment reservation."}</p>
  }

  const appearance: Appearance = {
    theme: resolvedTheme === "dark" ? "night" : "stripe",
  }

  return (
    <Elements
      stripe={stripeBrowser}
      options={{
        clientSecret,
        appearance,
      }}
    >
      <OfferPaymentForm
        clientSecret={clientSecret}
        totalUsd={totalUsd}
        disabled={disabled}
        onAuthorized={onAuthorized}
      />
    </Elements>
  )
}
