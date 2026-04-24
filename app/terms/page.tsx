import Link from "next/link"
import { FileText } from "lucide-react"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Terms of Service — Reswell",
  description: "Rules and guidelines for buying, selling, and using the Reswell surfboard marketplace.",
  path: "/terms",
})

export default function TermsOfServicePage() {
  return (
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
              <p className="text-muted-foreground mt-1">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">1. Agreement to terms</h2>
              <p className="leading-relaxed">
                By accessing or using Reswell (&ldquo;the platform,&rdquo; &ldquo;we,&rdquo; &ldquo;our&rdquo;), you agree to be bound by these Terms of Service and our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">2. What Reswell is</h2>
              <p className="leading-relaxed">
                Reswell is a peer to peer marketplace where surfers buy and sell surfboards, along with some related new gear from select shops. We provide the platform, messaging, checkout, shipping tools, and support. The actual transaction is between the buyer and the seller. We are not a party to that transaction unless we say otherwise (for example when we act on a Purchase Protection claim).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">3. Eligibility and accounts</h2>
              <p className="leading-relaxed">
                You must be at least 18 years old and able to form a binding contract to use Reswell. You&apos;re responsible for keeping your account credentials secure and for anything that happens under your account. Please give us accurate information when you sign up and keep it up to date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">4. Listings and conduct</h2>
              <p className="leading-relaxed mb-2">When you use Reswell, you agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Post accurate listings. Describe the board or item honestly (condition, dimensions, flaws, price) and use photos that actually represent what you&apos;re selling.</li>
                <li>Not list prohibited items (for example counterfeit goods, stolen items, or anything illegal to sell in your area).</li>
                <li>Communicate honestly and respectfully with other users, and complete your transactions in good faith.</li>
                <li>Follow our <Link href="/safety" className="text-primary underline">Safety Tips</Link> and any other guidelines we publish.</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We may remove listings or suspend accounts that break these terms or that we reasonably believe are harming other users or the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">5. Payments, fees, and payouts</h2>
              <p className="leading-relaxed">
                Buyers pay for orders through Reswell checkout using our payment processor. When a sale completes, we take a {MARKETPLACE_FEE_PERCENT}% marketplace fee and the remaining {SELLER_SHARE_PERCENT}% is the seller&apos;s. Payment processing on card purchases is not an extra deduction on top of that. Sellers cash out their balance to the payout destination they set up in their account. You are responsible for any taxes that apply to your sales or income, and for making sure the information on your payout account is accurate.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">6. Shipping, pickup, and Purchase Protection</h2>
              <p className="leading-relaxed">
                For shipped orders, sellers are expected to ship promptly and use tracked shipping. For local pickup, both parties arrange a safe meeting and complete the handoff in good faith. Eligible orders paid through Reswell checkout are covered by our Purchase Protection program, which is explained in detail on the <Link href="/protection-policy" className="text-primary underline">Purchase Protection</Link> page. Buyers do not pay an extra fee for protection, and sellers do not pay a separate protection deduction on top of the marketplace fee.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">7. Disputes between users</h2>
              <p className="leading-relaxed">
                If something goes sideways on an order, talk to the other person first. Most issues get solved with a quick message. If you need us, open a claim or message support from the order page and we&apos;ll step in where our Purchase Protection policy covers it. Outside of that, disputes are between the buyer and the seller. We may help facilitate a resolution or investigate abuse, but we are not obligated to resolve every dispute or to refund or compensate you. You use the platform and transact at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">8. Prohibited conduct</h2>
              <p className="leading-relaxed mb-2">You must not:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the platform for fraud, scams, or any illegal activity.</li>
                <li>Harass, threaten, or abuse other users or our staff.</li>
                <li>Try to work around the platform (for example taking a deal off Reswell to dodge fees after the buyer found it here, or encouraging payments outside of our checkout in bad faith).</li>
                <li>Scrape, automate, or otherwise misuse the platform in a way that harms performance or other users.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">9. Intellectual property</h2>
              <p className="leading-relaxed">
                Reswell and its branding, design, and content (not including user generated content) are owned by us or our licensors. Please don&apos;t copy, modify, or use our trademarks or content without permission. You keep ownership of your listings, photos, and messages. By posting them on Reswell, you give us a license to use them to run, display, and promote the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">10. Disclaimers</h2>
              <p className="leading-relaxed">
                The platform is provided &ldquo;as is.&rdquo; We can&apos;t guarantee that it will always be error free, secure, or uninterrupted. We disclaim warranties to the fullest extent permitted by law. We are not responsible for the quality, safety, or legality of items listed on the platform, or for the conduct of users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">11. Limitation of liability</h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, Reswell and its affiliates are not liable for any indirect, incidental, special, or consequential damages, or for any loss of profits or data, arising from your use of the platform or from transactions with other users. Our total liability is limited to the amount you paid us (if any) in the twelve months before the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">12. Changes and termination</h2>
              <p className="leading-relaxed">
                We may change these terms as the platform evolves. When we do, we&apos;ll post the updated version here and update the &ldquo;Last updated&rdquo; date above. If you keep using Reswell after an update takes effect, that means you accept the new terms. We may also suspend or end your access if you break these terms, or if we need to for the safety of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">13. Contact</h2>
              <p className="leading-relaxed">
                Questions about these Terms of Service? <Link href="/contact" className="text-primary underline">Contact us</Link>. We read every message.
              </p>
            </section>
          </div>
        </div>
      </main>
  )
}
