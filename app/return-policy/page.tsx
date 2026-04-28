import Link from "next/link"
import { Undo2 } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Return Policy — Reswell",
  description:
    "United States return policy for Reswell: defective and non-defective returns, 7-day window, no exchanges, refund timing, labels, and eligibility.",
  path: "/return-policy",
})

export default function ReturnPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Undo2 className="h-10 w-10 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Return Policy</h1>
            <p className="mt-1 text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
        </div>

        <div className="prose prose-neutral max-w-none space-y-8 text-muted-foreground dark:prose-invert">
          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">
              Countries &amp; overview
            </h2>
            <p className="leading-relaxed">
              This return policy applies to buyers with a delivery address in the{" "}
              <strong className="text-foreground">United States</strong> for eligible orders processed
              through Reswell checkout, except where exclusions apply below.
            </p>
            <ul className="mt-4 list-none space-y-3 pl-0 leading-relaxed">
              <li>
                <strong className="text-foreground">Returns.</strong> We accept returns for{" "}
                <strong className="text-foreground">defective and non-defective products</strong>, when the
                product and order meet this policy&apos;s eligibility, condition, timing, and process
                requirements.
              </li>
              <li>
                <strong className="text-foreground">Exchanges.</strong>{" "}
                <strong className="text-foreground">We do not accept exchanges.</strong> If an item doesn&apos;t work
                out, start a qualifying return instead of an exchange — refund timing is described below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">
              Product condition &amp; return window
            </h2>
            <p className="leading-relaxed">
              <strong className="text-foreground">Eligible product condition:</strong>{" "}
              <strong>New and slightly used</strong> — meaning the board or item qualifies as unused
              (&ldquo;new&rdquo;), opened, or lightly ridden / slightly used consistent with honest listing
              condition; it must remain return-eligible without abuse, undisclosed damage beyond what was
              agreed at sale, or loss of parts materially affecting resale.
            </p>
            <p className="mt-4 leading-relaxed">
              <strong className="text-foreground">Return window:</strong> you must initiate a qualifying
              return request within{" "}
              <strong className="text-foreground">
                seven (7) calendar days of delivery
              </strong>{" "}
              for shipped orders — measured from carrier delivery confirmation on the qualifying shipment —
              unless a longer promotional window applies (for example seasonal extensions we advertise on
              the site). For other fulfillment types, timelines may follow from handoff confirmation as
              described in your order and support communications.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">
              Methods, labels, fees &amp; refunds
            </h2>
            <p className="leading-relaxed mb-2">
              Depending on order type and what we authorize for your case, completing a return may use any
              of these paths when available:
            </p>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              <li>
                <strong className="text-foreground">By mail</strong> — Ship back using tracked mail with a
                return label issued through Reswell when we provide one.
              </li>
              <li>
                <strong className="text-foreground">At a drop-off location</strong> — e.g., carrier-operated drop
                spots when mailing a return parcel as instructed.
              </li>
              <li>
                <strong className="text-foreground">In person</strong> — Returning to a seller storefront or agreed
                in-person drop-off/meet-up when coordinated for your eligible order through Reswell and the
                seller.
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              <strong className="text-foreground">Return label.</strong> When Reswell supplies a prepaid return label
              for your approved return (including download-and-print labeling where offered),{" "}
              <strong className="text-foreground">there is no separate charge</strong> to you for that label fee.
              Follow the instructions attached to your return authorization.
            </p>
            <p className="mt-4 leading-relaxed">
              <strong className="text-foreground">Restocking fee.</strong>{" "}
              <strong>No restocking fee</strong> is assessed on approved returns governed by this policy.
              Other amounts (for example disputed damage or misuse) follow our Purchase Protection dispute
              review if applicable.
            </p>
            <p className="mt-4 leading-relaxed">
              <strong className="text-foreground">Refund processing time:</strong> after we approve a qualifying
              return and receive the returned item — or confirmation from tracking or seller receipt as stated
              in your case — we aim to process the refund{" "}
              <strong className="text-foreground">within approximately seven (7) days</strong>. Refunds typically
              return to your original payment method; bank posting times afterward depend on your card issuer or
              bank.
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Amounts involving currency conversion elsewhere on the marketplace may settle in USD as applicable
              to your checkout.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">
              Purchase Protection &amp; how this policy fits together
            </h2>
            <p className="leading-relaxed">
              Many returns involving damage in transit, non-delivery (where applicable), materially not as
              described, and related protection claims follow{" "}
              <Link href="/protection-policy" className="text-primary underline">
                Reswell Purchase Protection
              </Link>{" "}
              (evidence windows, exclusions, prepaid return labels where stated). Label and restocking terms on
              this page apply once a return path is authorized. Initiate defective and quality issues primarily
              through Purchase Protection workflows; initiate other qualifying returns via your order and support,
              staying within eligibility (including exclusions such as unsupported claims or pickups outside
              policy).
            </p>
            <p className="mt-4 leading-relaxed">
              This Return Policy is the storefront summary aligned with Merchant Center disclosures (US buyers,
              acceptance of defective and non-defective returns where eligible, no exchanges, timing, labels, and
              refund horizons). Orders that aren&apos;t eligible for checkout-backed returns (examples: some local
              pickup-only paths, violations of{" "}
              <Link href="/terms" className="text-primary underline">
                Terms of Service
              </Link>
              , or exclusions in Purchase Protection for your claim type) aren&apos;t covered by the return paths
              above even if broadly described here — use your order screens and support prompts for definitive
              qualification.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">Sellers</h2>
            <p className="leading-relaxed">
              Accurate listings (photos, flaws, measurements, condition) reduce disputes and help buyers return
              only within fair expectations. Payout adjustments for approved refunds follow Checkout and Purchase
              Protection procedures.
            </p>
          </section>

          <section>
            <h2 className="!mb-3 !mt-0 text-xl font-semibold text-foreground">Contact</h2>
            <p className="leading-relaxed">
              Start from your order in the dashboard or{" "}
              <Link href="/contact" className="text-primary underline">
                contact us
              </Link>{" "}
              with questions. Region-specific exceptions may be layered over time via separate posted terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
