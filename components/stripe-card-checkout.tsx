"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { CheckoutPaymentFormSkeleton } from "@/components/features/checkout/checkout-skeletons"
import { StripeJsUnavailable } from "@/components/stripe-js-unavailable"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import { useStripeBrowser } from "@/lib/stripe/use-stripe-browser"
import { buildOrderSuccessPath } from "@/lib/google-ads/purchase-success-path"
import { listingQuantitiesKey } from "@/lib/stripe/checkout-quantities-key"
import {
  ALREADY_PURCHASED_CHECKOUT_CODE,
  paidPaymentIntentIdFromConfirmResult,
  stripePaymentIntentLooksPaid,
} from "@/lib/stripe/checkout-payment-recovery"
import {
  clearStoredCheckoutSessionId,
  checkoutSessionStorageKey,
  readStoredCheckoutSessionId,
  writeStoredCheckoutSessionId,
} from "@/lib/stripe/checkout-session-storage"
import { finalizeMarketplaceOrderClient } from "@/lib/stripe/finalize-marketplace-order-client"
import { cn } from "@/lib/utils"

export { prefetchStripeJs } from "@/lib/stripe/load-stripe-browser"

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
  onConfirmLockChange,
}: {
  clientSecret: string
  amountLabel: string
  disabled: boolean
  submitButtonLabel?: string
  submitButtonClassName?: string
  buyerEmail?: string | null
  onConfirmLockChange?: (locked: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [elementLoadError, setElementLoadError] = useState<string | null>(null)
  const [expressVisible, setExpressVisible] = useState(false)

  const completeAfterSuccess = useCallback(
    async (paymentIntentId: string) => {
      onConfirmLockChange?.(true)
      const result = await finalizeMarketplaceOrderClient(paymentIntentId)
      if (!result.ok) {
        toast.error(
          "Payment received. Your order is confirming — check Purchases. Do not pay again.",
        )
        router.replace("/dashboard/purchases")
        return
      }
      router.replace(buildOrderSuccessPath(result.orderId, { reportPurchase: true }))
    },
    [onConfirmLockChange, router],
  )

  const confirmAndComplete = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!stripe || !elements) {
      return { ok: false, message: "Payment is still loading. Try again." }
    }

    onConfirmLockChange?.(true)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      onConfirmLockChange?.(false)
      return { ok: false, message: submitError.message ?? "Check your payment details and try again." }
    }

    const origin = window.location.origin
    let error: unknown
    let paymentIntent: { id?: string; status?: string } | undefined
    try {
      const confirmed = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${origin}/checkout/success`,
        },
        redirect: "if_required",
      })
      error = confirmed.error
      paymentIntent = confirmed.paymentIntent
    } catch (confirmErr) {
      error = confirmErr
    }

    let paidId = paidPaymentIntentIdFromConfirmResult({
      paymentIntent,
      error,
      clientSecret,
    })

    if (!paidId) {
      try {
        const retrieved = await stripe.retrievePaymentIntent(clientSecret)
        if (
          retrieved.paymentIntent?.id &&
          stripePaymentIntentLooksPaid(retrieved.paymentIntent.status)
        ) {
          paidId = retrieved.paymentIntent.id
        }
      } catch (retrieveErr) {
        console.error("Stripe retrievePaymentIntent after confirm error", retrieveErr)
      }
    }

    if (paidId) {
      await completeAfterSuccess(paidId)
      return { ok: true }
    }

    if (error) {
      onConfirmLockChange?.(false)
      const detail = formatStripeConfirmError(error)
      console.error("Stripe confirmPayment error", detail, error)
      const messageFromError =
        error &&
        typeof error === "object" &&
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message.trim()
          : ""
      const userMsg =
        messageFromError ||
        "Payment could not be confirmed. If this persists, confirm your Stripe publishable and secret keys are both test or both live from the same Stripe account (then redeploy so the publishable key matches the server)."
      return { ok: false, message: userMsg }
    }

    onConfirmLockChange?.(false)
    return { ok: true }
  }, [stripe, elements, clientSecret, completeAfterSuccess, onConfirmLockChange])

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

  useEffect(() => {
    if (!elements) return
    void elements.fetchUpdates()
  }, [elements, amountLabel])

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
  quantities,
  listingTitle,
  price,
  fulfillment,
  shippingAddressId,
  offerId,
  promoCode,
  shippingQuoteToken,
  packagingMode = null,
  purchaseDetailsReady = true,
  needsShipping = false,
  surfboardShipped = false,
  forceNewSession = false,
  applyReswellCredit = false,
  submitButtonLabel,
  submitButtonClassName,
  buyerEmail,
}: {
  listingIds: string[]
  quantities?: Record<string, number>
  listingTitle: string
  price: number
  fulfillment?: "pickup" | "shipping" | null
  shippingAddressId?: string | null
  offerId?: string | null
  promoCode?: string | null
  shippingQuoteToken?: string | null
  packagingMode?: "together" | "separate" | null
  purchaseDetailsReady?: boolean
  needsShipping?: boolean
  surfboardShipped?: boolean
  /** Start a new paid attempt for an in-stock quantity listing. */
  forceNewSession?: boolean
  /** Admin pilot: apply Reswell Credit toward the card charge. */
  applyReswellCredit?: boolean
  /** When set, replaces the default “Pay — $x” label. */
  submitButtonLabel?: string
  submitButtonClassName?: string
  /** Prefills Link / billing email when the buyer is signed in. */
  buyerEmail?: string | null
}) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [chargedTotalUsd, setChargedTotalUsd] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const paymentLockedRef = useRef(false)
  const forceNewConsumedRef = useRef(false)
  const checkoutSessionIdRef = useRef<string | null>(null)

  const { stripePromise, unavailable, retry } = useStripeBrowser()

  const listingIdsKey = [...listingIds].sort().join("|")
  const quantitiesKey = listingQuantitiesKey(quantities)
  const sessionStorageKey = checkoutSessionStorageKey({
    listingIdsKey,
    quantitiesKey,
    offerId: offerId ?? null,
  })

  const lockPaymentForm = useCallback((locked: boolean) => {
    paymentLockedRef.current = locked
  }, [])

  useEffect(() => {
    if (paymentLockedRef.current) return

    if (!stripePromise) {
      setLoading(false)
      return
    }

    if (!purchaseDetailsReady) {
      setError(null)
      setLoading(false)
      return
    }

    if (!listingIds.length) {
      setError(null)
      setLoading(false)
      return
    }

    if (needsShipping && !shippingAddressId) {
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    let navigatingAway = false
    setError(null)
    setLoading(true)

    const storedSessionId = readStoredCheckoutSessionId(sessionStorageKey)
    const resumeSessionId = checkoutSessionIdRef.current ?? storedSessionId
    const shouldForceNew = forceNewSession && !forceNewConsumedRef.current

    ;(async () => {
      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            listing_ids: listingIds,
            ...(quantities ? { quantities } : {}),
            ...(fulfillment ? { fulfillment } : {}),
            ...(needsShipping && shippingAddressId ? { address_id: shippingAddressId } : {}),
            ...(offerId ? { offer_id: offerId } : {}),
            ...(promoCode ? { promo_code: promoCode } : {}),
            ...(shippingQuoteToken ? { quote_token: shippingQuoteToken } : {}),
            ...(packagingMode ? { packaging_mode: packagingMode } : {}),
            ...(surfboardShipped ? { surfboard_shipped: true } : {}),
            ...(applyReswellCredit ? { apply_reswell_credit: true } : {}),
            ...(resumeSessionId && !shouldForceNew ? { checkout_session_id: resumeSessionId } : {}),
            ...(shouldForceNew ? { force_new_session: true } : {}),
          }),
        })
        const data = (await res.json()) as {
          clientSecret?: string
          error?: string
          code?: string
          orderId?: string
          alreadyPaid?: boolean
          paymentIntentId?: string
          checkoutSessionId?: string
          shippingUsd?: number
          totalUsd?: number
          reswellCreditUsd?: number
        }
        if (cancelled || paymentLockedRef.current) return
        if (data.checkoutSessionId?.trim()) {
          const nextSessionId = data.checkoutSessionId.trim()
          checkoutSessionIdRef.current = nextSessionId
          writeStoredCheckoutSessionId(sessionStorageKey, nextSessionId)
        }
        if (
          shouldForceNew &&
          (Boolean(data.checkoutSessionId?.trim()) ||
            data.alreadyPaid === true ||
            data.code === ALREADY_PURCHASED_CHECKOUT_CODE)
        ) {
          forceNewConsumedRef.current = true
        }
        if (
          res.status === 409 &&
          data.code === ALREADY_PURCHASED_CHECKOUT_CODE &&
          data.orderId?.trim()
        ) {
          navigatingAway = true
          clearStoredCheckoutSessionId(sessionStorageKey)
          router.replace(buildOrderSuccessPath(data.orderId.trim(), { reportPurchase: true }))
          return
        }
        if (res.ok && data.alreadyPaid && data.orderId?.trim()) {
          paymentLockedRef.current = true
          navigatingAway = true
          clearStoredCheckoutSessionId(sessionStorageKey)
          router.replace(buildOrderSuccessPath(data.orderId.trim(), { reportPurchase: true }))
          return
        }
        if (res.ok && data.alreadyPaid && data.paymentIntentId?.trim()) {
          paymentLockedRef.current = true
          navigatingAway = true
          const finalized = await finalizeMarketplaceOrderClient(data.paymentIntentId.trim())
          if (cancelled) return
          clearStoredCheckoutSessionId(sessionStorageKey)
          if (finalized.ok) {
            router.replace(buildOrderSuccessPath(finalized.orderId, { reportPurchase: true }))
            return
          }
          toast.error(
            "Payment received. Your order is confirming — check Purchases. Do not pay again.",
          )
          router.replace("/dashboard/purchases")
          return
        }
        if (!res.ok) {
          console.error("[StripeCardCheckout] create-payment-intent failed", {
            status: res.status,
            error: data.error,
          })
          setError(data.error ?? "Could not start card payment")
          return
        }
        if (data.clientSecret) {
          setClientSecret((current) =>
            current === data.clientSecret ? current : data.clientSecret ?? null,
          )
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
        if (!cancelled && !navigatingAway) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    listingIdsKey,
    quantitiesKey,
    fulfillment,
    price,
    shippingAddressId,
    offerId,
    promoCode,
    shippingQuoteToken,
    packagingMode,
    purchaseDetailsReady,
    needsShipping,
    surfboardShipped,
    forceNewSession,
    applyReswellCredit,
    sessionStorageKey,
    stripePromise,
    router,
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

  if (unavailable) {
    return <StripeJsUnavailable onRetry={retry} />
  }

  if (loading && !clientSecret) {
    return <CheckoutPaymentFormSkeleton />
  }

  if (error && !clientSecret) {
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
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance }}>
        <CheckoutForm
          clientSecret={clientSecret}
          amountLabel={`$${(chargedTotalUsd ?? price).toFixed(2)}`}
          disabled={loading}
          submitButtonLabel={submitButtonLabel}
          submitButtonClassName={submitButtonClassName}
          buyerEmail={buyerEmail}
          onConfirmLockChange={lockPaymentForm}
        />
      </Elements>
    </div>
  )
}
