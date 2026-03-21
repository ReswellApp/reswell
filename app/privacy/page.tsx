import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Shield } from "lucide-react"

export const metadata = {
  title: "Privacy Policy - Reswell",
  description: "Reswell privacy policy. How we collect, use, and protect your information.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground mt-1">
                Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">1. Introduction</h2>
              <p className="leading-relaxed">
                Reswell (“we,” “our,” or “us”) operates the Reswell marketplace. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services. By using Reswell, you agree to the practices described in this policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">2. Information we collect</h2>
              <p className="leading-relaxed mb-2">We may collect:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Account information:</strong> name, email address, profile photo, and display name when you sign up or update your profile.</li>
                <li><strong className="text-foreground">Listing and transaction data:</strong> listings you create, messages with other users, and Reswell Bucks balance and transaction history.</li>
                <li><strong className="text-foreground">Usage data:</strong> how you use the site (e.g. pages visited, actions taken) to improve our services and security.</li>
                <li><strong className="text-foreground">Device and log data:</strong> IP address, browser type, and similar technical information.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">3. How we use your information</h2>
              <p className="leading-relaxed">
                We use the information we collect to provide, maintain, and improve the marketplace; to process transactions and Reswell Bucks; to communicate with you (e.g. about your account or safety); to enforce our Terms of Service; and to comply with applicable law. We do not sell your personal information to third parties for marketing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">4. Sharing of information</h2>
              <p className="leading-relaxed">
                We may share information with service providers who help us operate the platform (e.g. hosting, authentication, analytics). When you use the marketplace, other users may see your display name, profile photo, and listing activity as needed for transactions and messaging. We may disclose information when required by law or to protect the safety and rights of our users and the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">5. Data security</h2>
              <p className="leading-relaxed">
                We use industry-standard measures to protect your data, including encryption and secure access controls. No method of transmission over the internet is 100% secure; we encourage you to use a strong password and to keep your account details private.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">6. Your choices</h2>
              <p className="leading-relaxed">
                You can update your profile and account settings in the dashboard. You may request access to, correction of, or deletion of your personal information by contacting us. Some data may be retained as required by law or for legitimate business purposes (e.g. transaction records).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">7. Cookies and tracking</h2>
              <p className="leading-relaxed">
                We use cookies and similar technologies for authentication, preferences, and analytics. For more detail, see our <Link href="/cookies" className="text-primary underline">Cookie Policy</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">8. Changes to this policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the “Last updated” date. Continued use of Reswell after changes constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">9. Contact</h2>
              <p className="leading-relaxed">
                Questions about this Privacy Policy? <Link href="/contact" className="text-primary underline">Contact us</Link>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
