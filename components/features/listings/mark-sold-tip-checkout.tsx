"use client"

import { useCallback, useState } from "react"
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
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { stripePublishableKey } from "@/lib/stripe/client-checkout-enabled"
import { cn } from "@/lib/utils"

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
  const [expressVisible, setExpressVisible] = useState(false)

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

    if (paymentIntent?.status === "succeeded") {
      onSuccess()
    }

    return { ok: true }
  }, [stripe, elements, clientSecret, onSuccess])

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
        console.error("Sale tip express checkout error", err)
        event.paymentFailed({ reason: "fail" })
        toast.error("Something went wrong. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [stripe, elements, confirmAndComplete],
  )

  return (
    <div className="space-y-4">
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
            buttonType: { applePay: "donate", googlePay: "donate" },
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
    </div>
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
