"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { stripeCardCheckoutEnabled } from "@/lib/stripe/client-checkout-enabled"

const StripeCardCheckout = dynamic(
  () =>
    import("@/components/stripe-card-checkout").then((m) => ({
      default: m.StripeCardCheckout,
    })),
  {
    ssr: false,
    // Matches the reserved min-h of the mounted Stripe element so the page doesn't reflow.
    loading: () => (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border bg-card text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading secure checkout…
      </div>
    ),
  },
)

interface PurchaseOptionsProps {
  listingIds: string[]
  listingTitle: string
  /** Total charged (item + shipping when applicable). */
  price: number
  /** Surfboards with pickup + shipping: which option the buyer selected. */
  fulfillment?: "pickup" | "shipping" | null
  /** Required on server when fulfillment is shipping. */
  shippingAddressId?: string | null
  /** When set, server validates against this accepted offer (bundle checkout). */
  offerId?: string | null
  /** Newsletter welcome promo code (Reswell-funded discount). */
  promoCode?: string | null
  /** Signed token from `/api/checkout/shipping-quote` — charges that ShipEngine rate without a second lookup. */
  shippingQuoteToken?: string | null
  /** When false, card checkout stays disabled until purchase details are complete. */
  purchaseDetailsReady?: boolean
  /** True when the order ships (includes ship-only listings where fulfillment is undefined). */
  needsShipping?: boolean
  submitButtonLabel?: string
  submitButtonClassName?: string
  /** Hide the default one-line Stripe footer (when the parent already shows secure copy). */
  hideStripeFooter?: boolean
  /** Prefills Link / billing email when the buyer is signed in. */
  buyerEmail?: string | null
}

function purchaseDetailsPlaceholder(needsShipping: boolean): string {
  if (needsShipping) {
    return "Add your phone number and shipping address above to continue to payment."
  }
  return "Add your phone number above to continue to payment."
}

export function PurchaseOptions({
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
  hideStripeFooter = false,
  buyerEmail,
}: PurchaseOptionsProps) {
  const showCard = stripeCardCheckoutEnabled()

  const canMountStripe =
    purchaseDetailsReady && (!needsShipping || Boolean(shippingAddressId?.trim()))

  if (!showCard) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Card checkout is not configured. Please try again later or{" "}
        <Link href="/faq" className="text-primary underline underline-offset-2">
          contact support
        </Link>
        .
      </div>
    )
  }

  // Reserve space matching the mounted Stripe element + Pay button so the page
  // doesn't shift when the iframe loads (CLS fix).
  return (
    <div className="flex min-h-[400px] flex-col">
      {!canMountStripe ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {purchaseDetailsPlaceholder(needsShipping)}
        </div>
      ) : (
        <div className="flex flex-1 flex-col space-y-3">
          <StripeCardCheckout
            listingIds={listingIds}
            listingTitle={listingTitle}
            price={price}
            fulfillment={fulfillment ?? null}
            shippingAddressId={shippingAddressId ?? null}
            offerId={offerId ?? null}
            promoCode={promoCode ?? null}
            shippingQuoteToken={shippingQuoteToken ?? null}
            purchaseDetailsReady
            needsShipping={needsShipping}
            submitButtonLabel={submitButtonLabel}
            submitButtonClassName={submitButtonClassName}
            buyerEmail={buyerEmail}
          />
          {!hideStripeFooter ? (
            <p className="text-xs text-muted-foreground">Secure payment processed by Stripe.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
