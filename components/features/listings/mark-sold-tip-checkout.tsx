"use client"

import { useCallback, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { Appearance } from "@stripe/stripe-js"
import { useTheme } from "next-themes"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { finalizeListingSaleTip } from "@/lib/listing-sale-feedback-request"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  const key = stripePublishableKey()
  if (!key) return null
  stripePromise ??= loadStripe(key)
  return stripePromise
}

/** Warm Stripe.js while the seller picks a tip amount. */
export function prefetchSaleTipStripeJs(): void {
  void getStripeBrowser()
}

function formatStripeConfirmError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim()) return msg
  }
  return "Payment could not be confirmed."
}

function TipPaymentForm({
  listingId,
  clientSecret,
  amountLabel,
  onSuccess,
}: {
  listingId: string
  clientSecret: string
  amountLabel: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)
  const [paymentReady, setPaymentReady] = useState(false)

  const completeAfterSuccess = useCallback(
    async (paymentIntentId: string) => {
      const finalized = await finalizeListingSaleTip(listingId, paymentIntentId)
      if (!finalized.ok) {
        console.error("Sale tip finalize failed", finalized.error)
      }
      onSuccess()
    },
    [listingId, onSuccess],
  )

  const confirmAndComplete = useCallback(async (): Promise<
    { ok: true } | { ok: false; message: string }
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
        return_url: window.location.href,
      },
      redirect: "if_required",
    })

    if (error) {
      console.error("Stripe confirmPayment error", formatStripeConfirmError(error), error)
      return { ok: false, message: error.message ?? "Payment could not be confirmed." }
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
        console.error("Sale tip checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, confirmAndComplete],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {elementLoadError ? <p className="text-xs text-destructive">{elementLoadError}</p> : null}
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-2">
        {!paymentReady && !elementLoadError ? (
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading card form…
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          <PaymentElement
            options={{
              layout: "tabs",
              paymentMethodOrder: ["card"],
              wallets: { applePay: "never", googlePay: "never" },
              fields: {
                billingDetails: {
                  name: "never",
                  email: "never",
                  phone: "never",
                  address: "never",
                },
              },
            }}
            onReady={() => setPaymentReady(true)}
            onLoadError={(event) => {
              const msg =
                event.error?.message?.trim() ||
                "Payment form failed to load. Confirm Stripe keys are configured."
              setElementLoadError(msg)
              toast.error(msg)
            }}
          />
        </div>
        <Button
          type="submit"
          className="h-9 w-full shrink-0"
          disabled={busy || !stripe || !!elementLoadError}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            `Send ${amountLabel} tip`
          )}
        </Button>
      </form>
    </div>
  )
}

export function MarkSoldTipCheckout({
  listingId,
  clientSecret,
  amountCents,
  onSuccess,
}: {
  listingId: string
  clientSecret: string
  amountCents: number
  onSuccess: () => void
}) {
  const { resolvedTheme } = useTheme()
  const stripe = getStripeBrowser()
  const amountLabel = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`

  if (!stripe) {
    return (
      <p className="text-sm text-destructive">
        Card payments aren&apos;t available right now. Refresh and try again, or skip the tip.
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
            spacingUnit: "3px",
            fontSizeBase: "14px",
          },
        }

  return (
    <Elements
      key={clientSecret}
      stripe={stripe}
      options={{ clientSecret, appearance, loader: "auto" }}
    >
      <TipPaymentForm
        listingId={listingId}
        clientSecret={clientSecret}
        amountLabel={amountLabel}
        onSuccess={onSuccess}
      />
    </Elements>
  )
}
