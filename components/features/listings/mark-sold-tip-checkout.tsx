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
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"

let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripeBrowser() {
  const key = stripePublishableKey()
  if (!key) return null
  stripePromise ??= loadStripe(key)
  return stripePromise
}

function formatStripeConfirmError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim()) return msg
  }
  return "Payment could not be confirmed."
}

function TipPaymentForm({
  clientSecret,
  amountLabel,
  onSuccess,
}: {
  clientSecret: string
  amountLabel: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
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
          toast.error(error.message ?? "Payment could not be confirmed.")
          return
        }

        if (paymentIntent?.status === "succeeded") {
          onSuccess()
        }
      } catch (err) {
        console.error("Sale tip checkout error", err)
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, clientSecret, onSuccess],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {elementLoadError ? <p className="text-sm text-destructive">{elementLoadError}</p> : null}
      <PaymentElement
        options={{ paymentMethodOrder: ["card", "link"] }}
        onLoadError={(event) => {
          const msg =
            event.error?.message?.trim() ||
            "Payment form failed to load. Confirm Stripe keys are configured."
          setElementLoadError(msg)
          toast.error(msg)
        }}
      />
      <Button type="submit" className="w-full" disabled={busy || !stripe || !!elementLoadError}>
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
  )
}

export function MarkSoldTipCheckout({
  clientSecret,
  amountCents,
  onSuccess,
}: {
  clientSecret: string
  amountCents: number
  onSuccess: () => void
}) {
  const { resolvedTheme } = useTheme()
  const stripe = getStripeBrowser()
  const amountLabel = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`

  if (!stripe) {
    return <p className="text-sm text-muted-foreground">Tips aren&apos;t available right now.</p>
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
    <Elements key={clientSecret} stripe={stripe} options={{ clientSecret, appearance }}>
      <TipPaymentForm
        clientSecret={clientSecret}
        amountLabel={amountLabel}
        onSuccess={onSuccess}
      />
    </Elements>
  )
}
