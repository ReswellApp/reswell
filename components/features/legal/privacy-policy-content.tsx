import Link from "next/link"
import { cn } from "@/lib/utils"
import { legalHeadingClass, legalProseClass } from "@/components/features/legal/legal-prose-classes"

const linkClass = "text-primary underline"

export function PrivacyPolicyContent({ compact = false }: { compact?: boolean }) {
  const h2 = legalHeadingClass(compact)

  return (
    <div className={legalProseClass(compact)}>
      <section>
        <h2 className={cn(h2, compact && "mt-0")}>1. Introduction</h2>
        <p className="leading-relaxed">
          Reswell (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) runs a peer to peer
          marketplace where surfers buy and sell surfboards, along with some related new gear from
          select shops. This Privacy Policy explains what information we collect when you use
          reswell.com and our services, how we use it, who we share it with, and the choices you have.
          By using Reswell, you agree to the practices described here. If you don&apos;t agree, please
          don&apos;t use the platform.
        </p>
      </section>

      <section>
        <h2 className={h2}>2. Information we collect</h2>
        <p className="mb-2 leading-relaxed">Depending on how you use Reswell, we may collect:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong className="text-foreground">Account information.</strong> Your name, email
            address, password (stored hashed by our auth provider), display name, seller slug, profile
            photo, bio, and the city or general location you choose to show on your profile.
          </li>
          <li>
            <strong className="text-foreground">Shop information</strong> for sellers who run a shop:
            shop name, description, logo, banner, address, phone, and website. Only what you choose to
            provide when you set up your shop profile.
          </li>
          <li>
            <strong className="text-foreground">Listings.</strong> Photos, titles, descriptions,
            pricing, condition, brand, board measurements (length, width, thickness, volume), fin
            setup, pickup location, and shipping preferences.
          </li>
          <li>
            <strong className="text-foreground">Purchases and transactions.</strong> Items purchased
            or sold, offers made, shipping addresses, tracking numbers, purchase status, reviews,
            refund and purchase protection claims, and the messages attached to a purchase.
          </li>
          <li>
            <strong className="text-foreground">Payment and payout details.</strong> When you buy, our
            payment processor handles your card information directly. We don&apos;t store your full
            card number. When you sell and cash out your earnings, we collect the payout details you
            give us so the money can be sent to the right place.
          </li>
          <li>
            <strong className="text-foreground">Messages and support.</strong> Conversations you have
            with other users through Reswell, contact form submissions, and the details you share when
            you ask for help or open a refund request (including photos, tracking info, and purchase
            context).
          </li>
          <li>
            <strong className="text-foreground">Community content.</strong> Posts, comments, and
            anything else you share in Board Talk, on a seller profile, or elsewhere on the platform.
          </li>
          <li>
            <strong className="text-foreground">Usage data.</strong> Pages viewed, listings you
            favorite, searches you run, and actions you take, so we can make the marketplace work
            better and safer.
          </li>
          <li>
            <strong className="text-foreground">Device and log data.</strong> IP address, browser and
            device type, operating system, referring URL, and similar technical information collected
            automatically when you use the site.
          </li>
          <li>
            <strong className="text-foreground">Cookies and similar technologies.</strong> See our{" "}
            <Link href="/cookies" className={linkClass}>
              Cookie Policy
            </Link>{" "}
            for details.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={h2}>3. How we use your information</h2>
        <p className="mb-2 leading-relaxed">We use the information we collect to:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Run the marketplace. That means creating and displaying listings, enabling messaging,
            powering search and recommendations, and keeping features like favorites, followers, and
            Board Talk working.
          </li>
          <li>
            Process checkout, offers, purchases, and seller cash outs, and keep accurate records of
            every transaction.
          </li>
          <li>
            Coordinate shipping and delivery, including generating and tracking labels for shipped
            purchases.
          </li>
          <li>
            Administer Reswell Purchase Protection. We review claims, ask for the evidence we need
            (photos, tracking, messages), and decide covered outcomes based on our{" "}
            <Link href="/protection-policy" className={linkClass}>
              Protection Policy
            </Link>
            .
          </li>
          <li>
            Send service communications about your account, purchases, messages, and safety. Where
            permitted, we may also send you product updates you can opt out of.
          </li>
          <li>
            Prevent fraud and abuse, enforce our{" "}
            <Link href="/terms" className={linkClass}>
              Terms of Service
            </Link>
            , and keep the community safe.
          </li>
          <li>
            Understand how the site is used so we can improve performance, reliability, and the
            overall experience.
          </li>
          <li>Comply with applicable laws and respond to lawful requests.</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          We do not sell your personal information to third parties for their own marketing.
        </p>
      </section>

      <section>
        <h2 className={h2}>4. Service providers we share information with</h2>
        <p className="mb-2 leading-relaxed">
          To run Reswell we share limited information with vetted providers who process data on our
          behalf under contract. Categories include:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong className="text-foreground">Hosting and infrastructure.</strong> Our hosting
            platform, content delivery network, and database and auth provider (Supabase), which store
            and serve site data.
          </li>
          <li>
            <strong className="text-foreground">Payments.</strong> Stripe processes card payments and
            holds card data directly. We receive a token and limited metadata, not your full card
            number.
          </li>
          <li>
            <strong className="text-foreground">Seller payouts.</strong> The bank and payout rails we
            use to send sellers their earnings.
          </li>
          <li>
            <strong className="text-foreground">Shipping and tracking.</strong> ShipEngine and the
            carriers you ship with, so we can generate labels, pull rate quotes, and show delivery
            tracking.
          </li>
          <li>
            <strong className="text-foreground">Email and notifications.</strong> Transactional email
            providers that send purchase, message, and account emails.
          </li>
          <li>
            <strong className="text-foreground">Analytics and advertising.</strong> Tools that help us
            understand usage and measure conversions, including Google Ads conversion tracking when
            enabled. See our{" "}
            <Link href="/cookies" className={linkClass}>
              Cookie Policy
            </Link>
            .
          </li>
        </ul>
      </section>

      <section>
        <h2 className={h2}>5. Information visible to other users</h2>
        <p className="leading-relaxed">
          Reswell is a marketplace, so some information is intentionally public or shared with the
          other party to a transaction. Your display name, seller slug, profile photo, bio, general
          city, and active listings are visible to other users. Shop profiles show the shop details
          you provide, like name, description, logo, banner, city, and (if you set them) address,
          phone, and website. When you buy or sell, the other person needs enough information to
          complete the deal. Buyers can see the seller&apos;s display name and messaging thread.
          Sellers receive the buyer&apos;s display name and shipping address for shipped purchases,
          and see pickup messages for local pickup. Reviews and public community posts (like Board
          Talk) appear under your display name.
        </p>
      </section>

      <section>
        <h2 className={h2}>6. Legal and safety disclosures</h2>
        <p className="leading-relaxed">
          We may disclose information when we believe in good faith that it&apos;s necessary to comply
          with a law, regulation, subpoena, or other legal process; to enforce our{" "}
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>{" "}
          or investigate suspected violations; to protect the rights, property, or safety of Reswell,
          our users, or the public; or in connection with a merger, acquisition, financing, or sale of
          business assets, in which case we will require the recipient to honor this Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className={h2}>7. Data retention</h2>
        <p className="leading-relaxed">
          We keep your information for as long as your account is active and as needed to provide the
          service, resolve disputes, enforce our agreements, and comply with our legal obligations
          (for example, tax and financial recordkeeping tied to sales and payouts). When you delete
          your account, we delete or de-identify personal information that we&apos;re not required to
          retain. Some content may remain in backups for a limited period or persist in anonymized
          aggregate form.
        </p>
      </section>

      <section>
        <h2 className={h2}>8. Data security</h2>
        <p className="leading-relaxed">
          We use industry standard safeguards including HTTPS/TLS in transit, encryption at rest with
          our hosting providers, row level access controls on our database, and limited internal
          access to personal data. No system is 100% secure. Please use a strong, unique password,
          keep your device and email secure, and contact us right away if you think your account has
          been compromised.
        </p>
      </section>

      <section>
        <h2 className={h2}>9. Your choices and rights</h2>
        <p className="mb-2 leading-relaxed">You can:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Update your profile, shop, and account settings from your{" "}
            <Link href="/dashboard/profile" className={linkClass}>
              dashboard
            </Link>
            .
          </li>
          <li>Edit or archive your listings at any time.</li>
          <li>Control which emails you receive from your notification preferences.</li>
          <li>
            Manage cookies through your browser. See our{" "}
            <Link href="/cookies" className={linkClass}>
              Cookie Policy
            </Link>
            .
          </li>
          <li>
            Request access to, correction of, or deletion of your personal information by{" "}
            <Link href="/contact" className={linkClass}>
              contacting us
            </Link>
            . Depending on where you live, you may also have rights under laws like GDPR or CCPA
            (including the right to know, delete, correct, or opt out of certain uses). We honor those
            rights for residents of covered regions.
          </li>
        </ul>
        <p className="mt-4 leading-relaxed">
          Some information may be retained even after deletion where required by law or for legitimate
          business needs, for example transaction records tied to a completed sale, payout, or open
          dispute.
        </p>
      </section>

      <section>
        <h2 className={h2}>10. Children</h2>
        <p className="leading-relaxed">
          Reswell is not directed to children under 18, and you must be at least 18 to use the
          platform. We do not knowingly collect personal information from children under 18. If you
          believe a child has provided us with personal information, please{" "}
          <Link href="/contact" className={linkClass}>
            contact us
          </Link>{" "}
          and we will take appropriate steps to remove it.
        </p>
      </section>

      <section>
        <h2 className={h2}>11. International users</h2>
        <p className="leading-relaxed">
          Reswell is operated from the United States. If you access the platform from outside the
          U.S., your information will be transferred to, stored, and processed in the U.S. and in
          other countries where our service providers operate. Those countries may have different data
          protection laws than your own. By using Reswell, you consent to that transfer.
        </p>
      </section>

      <section>
        <h2 className={h2}>12. Cookies and tracking</h2>
        <p className="leading-relaxed">
          We use cookies and similar technologies for authentication, preferences, analytics, and
          (where enabled) advertising conversion measurement. See our{" "}
          <Link href="/cookies" className={linkClass}>
            Cookie Policy
          </Link>{" "}
          for detail and how to control them.
        </p>
      </section>

      <section>
        <h2 className={h2}>13. Changes to this policy</h2>
        <p className="leading-relaxed">
          We may update this Privacy Policy as the platform evolves. When we do, we&apos;ll post the
          updated version here and refresh the &ldquo;Last updated&rdquo; date above. For material
          changes, we&apos;ll also let you know through the site or by email. If you keep using
          Reswell after an update takes effect, that means you accept the changes.
        </p>
      </section>

      <section>
        <h2 className={h2}>14. Contact</h2>
        <p className="leading-relaxed">
          Questions, requests, or concerns about this Privacy Policy or your data?{" "}
          <Link href="/contact" className={linkClass}>
            Contact us
          </Link>
          . We read every message.
        </p>
      </section>
    </div>
  )
}
