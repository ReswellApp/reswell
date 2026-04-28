import Link from "next/link"
import { Undo2 } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Return Policy — Reswell",
  description:
    "How returns, refunds, and exchanges work on Reswell for peer-to-peer surfboard sales and eligible checkout orders.",
  path: "/return-policy",
})

export default function ReturnPolicyPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Undo2 className="h-10 w-10 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Return Policy</h1>
            <p className="mt-1 text-muted-foreground">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="prose prose-neutral max-w-none space-y-6 text-muted-foreground dark:prose-invert">
          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">1. How Reswell works</h2>
            <p className="leading-relaxed">
              Reswell is a peer-to-peer marketplace. Sales are primarily between individual buyers and
              sellers — not traditional retail where a store publishes a blanket &ldquo;change your mind&rdquo;
              return window. What happens after you pay depends on how you paid, what went wrong (if anything),
              and whether your order is eligible for our buyer coverage.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">
              2. Orders paid through Reswell checkout
            </h2>
            <p className="leading-relaxed">
              For eligible orders completed through Reswell checkout, buyers may be entitled to refunds
              when a covered problem occurs — for example non-delivery, the item arriving materially
              different from the listing, or damage in transit, subject to the rules and timelines in
              our{" "}
              <Link href="/protection-policy" className="text-primary underline">
                Purchase Protection
              </Link>{" "}
              policy. That page is the authoritative description of protections, exclusions, claims,
              evidence, and returns that we coordinate (such as prepaid return labels where required).
            </p>
            <p className="leading-relaxed mt-4">
              Buyers do not pay a separate fee for Purchase Protection on covered eligible orders.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">
              3. Voluntary returns and exchanges
            </h2>
            <p className="leading-relaxed">
              Outside of Purchase Protection — for example when you simply change your mind, or when a
              situation is not covered — returns and exchanges are{' '}
              <strong className="text-foreground">between you and the other party</strong>. We encourage buyers
              and sellers to agree on expectations in messages before completing a sale. If both parties want
              to arrange a voluntary return or exchange, you can coordinate shipping or meetup yourselves;
              Reswell does not guarantee that outcome unless it falls under Purchase Protection after a covered
              claim is approved according to our policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">4. Local pickup</h2>
            <p className="leading-relaxed">
              Orders completed as{' '}
              <strong className="text-foreground">local pickup</strong> do not qualify for Purchase Protection
              the same way shipped orders do. Inspect the board at pickup when you can. Problems after pickup
              are resolved between buyer and seller unless another policy applies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">5. Sellers</h2>
            <p className="leading-relaxed">
              Describe your listings accurately — condition, flaws, measurements, and photos — so buyers know
              what they are purchasing. Covered claims handled under Purchase Protection follow the process set
              out on the{' '}
              <Link href="/protection-policy" className="text-primary underline">
                Purchase Protection
              </Link>{" "}
              page (including payouts and required returns where applicable).
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">6. Relationship to other terms</h2>
            <p className="leading-relaxed">
              This Return Policy supplements our{" "}
              <Link href="/terms" className="text-primary underline">
                Terms of Service
              </Link>
              , which describe fees, eligibility, disputes, and platform rules. Nothing here limits our ability
              to enforce those terms or apply Purchase Protection consistently with the{" "}
              <Link href="/protection-policy" className="text-primary underline">
                Purchase Protection
              </Link>{" "}
              policy.
            </p>
          </section>

          <section>
            <h2 className="mb-2 mt-8 text-xl font-semibold text-foreground">7. Questions</h2>
            <p className="leading-relaxed">
              For help with a specific order or claim, follow the prompts on your order page or{" "}
              <Link href="/contact" className="text-primary underline">
                contact us
              </Link>
              . We read every message.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
