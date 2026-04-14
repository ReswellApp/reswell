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
                Cookies are small text files that websites store on your device (computer, tablet, or phone) when you visit. They help the site remember your preferences, keep you signed in, and understand how the site is used so we can improve it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">2. How we use cookies</h2>
              <p className="leading-relaxed mb-2">Reswell uses cookies and similar technologies for:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Strictly necessary:</strong> Required for the site to work (e.g. keeping you logged in, securing your session, and load balancing).</li>
                <li><strong className="text-foreground">Preferences:</strong> Remembering your settings (e.g. theme or language) so you don’t have to set them again.</li>
                <li><strong className="text-foreground">Analytics and performance:</strong> Understanding how people use the site (e.g. which pages are visited, errors) so we can improve performance and fix issues. This may include third-party tools that use cookies or similar tech.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">3. Third-party cookies</h2>
              <p className="leading-relaxed">
                We may use services from third parties (e.g. authentication, hosting, or analytics) that set their own cookies or use similar technologies. Those parties have their own privacy and cookie policies. We only work with providers that use data in ways consistent with our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">4. Your choices</h2>
              <p className="leading-relaxed">
                Most browsers let you block or delete cookies through their settings. If you block or delete cookies, some parts of Reswell may not work correctly (for example, you may be logged out or preferences may not be saved). You can also use “Do Not Track” or similar signals; we consider those signals where our tools support them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">5. Updates</h2>
              <p className="leading-relaxed">
                We may update this Cookie Policy from time to time to reflect changes in our practices or in law. We will post the updated policy on this page and update the “Last updated” date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">6. Contact</h2>
              <p className="leading-relaxed">
                Questions about our use of cookies? <Link href="/contact" className="text-primary underline">Contact us</Link>.
              </p>
            </section>
          </div>
        </div>
      </main>
  )
}
