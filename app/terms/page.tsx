import Link from "next/link"
import { FileText } from "lucide-react"
import { MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Terms of Service — Reswell",
  description: "Rules and guidelines for buying, selling, and using the Reswell marketplace.",
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
                By accessing or using Reswell (“the platform,” “we,” “our”), you agree to be bound by these Terms of Service and our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. If you do not agree, do not use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">2. Description of service</h2>
              <p className="leading-relaxed">
                Reswell is a peer-to-peer marketplace where users can list, browse, and buy or sell surf gear and related items. We provide the platform, messaging, and Reswell Bucks (in-app currency); transactions are between buyers and sellers. We are not a party to those transactions unless otherwise stated.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">3. Eligibility and accounts</h2>
              <p className="leading-relaxed">
                You must be at least 18 years old and able to form a binding contract to use the platform. You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate information and update it as needed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">4. Listings and conduct</h2>
              <p className="leading-relaxed mb-2">You agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Post accurate listings (description, condition, price) and use photos that represent the item.</li>
                <li>Not list prohibited items (e.g. counterfeit goods, stolen items, or anything illegal).</li>
                <li>Communicate honestly and respectfully with other users and to complete transactions in good faith.</li>
                <li>Follow our <Link href="/safety" className="text-primary underline">Safety Tips</Link> and any other guidelines we publish.</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We may remove listings or suspend accounts that violate these terms or that we reasonably believe harm the community or the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">5. Reswell Bucks and payments</h2>
              <p className="leading-relaxed">
                Reswell Bucks are an in-app currency used for purchases on the platform. They have no cash value
                outside the platform except when cashed out according to our wallet and cash-out rules. For used
                gear sales, the platform charges a {MARKETPLACE_FEE_PERCENT}% marketplace fee; card payments also
                include payment processing (~2.9% + $0.30). Cash-out to real currency: 0% standard payout; 1%
                instant payout. Other details are in the app. You are responsible for any taxes that apply to your
                sales or income.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">6. Disputes between users</h2>
              <p className="leading-relaxed">
                Disputes between buyers and sellers are primarily between those users. We may, in our discretion, help facilitate resolution or investigate abuse, but we are not obligated to resolve disputes or to refund or compensate you. You use the platform and transact at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">7. Prohibited conduct</h2>
              <p className="leading-relaxed mb-2">You must not:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the platform for fraud, scams, or illegal activity.</li>
                <li>Harass, threaten, or abuse other users or our staff.</li>
                <li>Circumvent the platform (e.g. to avoid fees or to conduct off-platform deals in bad faith).</li>
                <li>Scrape, automate, or misuse the platform in a way that harms performance or other users.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">8. Intellectual property</h2>
              <p className="leading-relaxed">
                Reswell and its branding, design, and content (excluding user-generated content) are owned by us or our licensors. You may not copy, modify, or use our trademarks or content without permission. You retain ownership of your listings and messages; you grant us a license to use them to operate and promote the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">9. Disclaimers</h2>
              <p className="leading-relaxed">
                The platform is provided “as is.” We do not guarantee that it will be error-free, secure, or uninterrupted. We disclaim warranties to the fullest extent permitted by law. We are not responsible for the quality, safety, or legality of items listed or for the conduct of users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">10. Limitation of liability</h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, Reswell and its affiliates are not liable for any indirect, incidental, special, or consequential damages, or for any loss of profits or data, arising from your use of the platform or from transactions with other users. Our total liability is limited to the amount you paid us (if any) in the twelve months before the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">11. Changes and termination</h2>
              <p className="leading-relaxed">
                We may change these terms at any time by posting an updated version and updating the “Last updated” date. Continued use after changes means you accept the new terms. We may suspend or terminate your account or access if you breach these terms or for other reasons we consider necessary for the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">12. Contact</h2>
              <p className="leading-relaxed">
                For questions about these Terms of Service, <Link href="/contact" className="text-primary underline">contact us</Link>.
              </p>
            </section>
          </div>
        </div>
      </main>
  )
}
