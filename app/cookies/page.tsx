import Link from "next/link"
import { Cookie } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Cookie Policy — Reswell",
  description: "How Reswell uses cookies and similar technologies on the site.",
  path: "/cookies",
})

export default function CookiePolicyPage() {
  return (
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Cookie className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
              <p className="text-muted-foreground mt-1">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">1. What are cookies?</h2>
              <p className="leading-relaxed">
                Cookies are small text files that websites store on your device (computer, tablet, or phone) when you visit them. They help the site remember your preferences, keep you signed in, and understand how the site is being used so we can make it better.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">2. How we use cookies</h2>
              <p className="leading-relaxed mb-2">Reswell uses cookies and similar technologies for a few things:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Strictly necessary.</strong> Required for the site to work. For example, keeping you logged in, securing your session, running checkout, and balancing traffic across our servers.</li>
                <li><strong className="text-foreground">Preferences.</strong> Remembering your settings (like theme or language) so you don&apos;t have to set them again every visit.</li>
                <li><strong className="text-foreground">Analytics and performance.</strong> Helping us understand how people use Reswell (which pages get visited, where errors happen, how fast things load) so we can fix issues and improve the experience. This may include third party tools that use cookies or similar tech.</li>
                <li><strong className="text-foreground">Advertising and conversion measurement.</strong> Where enabled, we use tools like Google Ads conversion tracking to understand how our ads perform (for example, whether someone who clicked an ad ended up creating an account or completing a purchase). See our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> for more.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">3. Third party cookies</h2>
              <p className="leading-relaxed">
                Some of the tools we use (for example our authentication provider, hosting platform, payment processor, and analytics or advertising tools) set their own cookies or use similar technologies. Those providers have their own privacy and cookie policies. We only work with providers that handle data in ways consistent with our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">4. Your choices</h2>
              <p className="leading-relaxed">
                Most browsers let you block or delete cookies through their settings. If you do block or delete them, some parts of Reswell may not work correctly. For example, you may get signed out, preferences may not save, or checkout may not complete. You can also use &ldquo;Do Not Track&rdquo; or similar signals. We respect those signals where our tools support them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">5. Updates</h2>
              <p className="leading-relaxed">
                We may update this Cookie Policy from time to time as the site evolves or as rules around cookies change. When we do, we&apos;ll post the new version on this page and update the &ldquo;Last updated&rdquo; date above.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">6. Contact</h2>
              <p className="leading-relaxed">
                Questions about our use of cookies? <Link href="/contact" className="text-primary underline">Contact us</Link>. We read every message.
              </p>
            </section>
          </div>
        </div>
      </main>
  )
}
