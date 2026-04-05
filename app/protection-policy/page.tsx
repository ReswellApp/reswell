import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck, Package, Tag, AlertTriangle, HelpCircle, CheckCircle2, XCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Reswell Purchase Protection | Safe Surf Gear Marketplace',
  description:
    'Every order on Reswell is backed by Purchase Protection. Every dollar you paid — item price and shipping — is guaranteed back. No caps. No limits. No exceptions.',
}

function Section({
  icon: Icon,
  iconColor = 'text-green-600 dark:text-green-400',
  bg = 'bg-green-50/60 dark:bg-green-950/20 border-green-200 dark:border-green-800/40',
  title,
  children,
}: {
  icon: React.ElementType
  iconColor?: string
  bg?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border p-6 ${bg}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      <div className="text-sm text-foreground/80 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function ProtectionPolicyPage() {
  return (
    <div className="container mx-auto max-w-2xl py-12 px-4 space-y-10">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-5">
            <ShieldCheck className="h-10 w-10 text-green-600 dark:text-green-400" aria-hidden />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reswell Purchase Protection
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-base">
          Every order placed on Reswell is backed by our Purchase Protection. Every customer gets
          back every dollar they paid. No caps. No limits. No exceptions.
        </p>
      </div>

      {/* Coverage sections */}
      <div className="space-y-4">
        <Section
          icon={Package}
          title="If your item never arrives"
        >
          <p>
            If your item never arrives, you get back <strong>every dollar you paid</strong> — item
            price and shipping. No cap, no return needed. Guaranteed.
          </p>
          <p className="text-muted-foreground text-xs">
            No questions asked if tracking confirms non-delivery.
          </p>
        </Section>

        <Section
          icon={Tag}
          title="If your item is not as described"
        >
          <p>
            If your item is significantly different from what was listed, you get back{' '}
            <strong>every dollar you paid</strong> — item price and shipping. We&apos;ll send you a
            free prepaid return label. Your refund is released the moment the seller confirms
            receipt.
          </p>
          <p className="text-muted-foreground text-xs">
            Note: &ldquo;Significantly different&rdquo; means a material mismatch from the listing
            description. Minor cosmetic differences not mentioned in the listing do not qualify.
          </p>
        </Section>

        <Section
          icon={AlertTriangle}
          title="If your item arrives damaged"
        >
          <p>
            If your item arrives damaged, you get back <strong>every dollar you paid</strong> —
            item price and shipping. We&apos;ll send you a free prepaid return label. Your refund is
            released the moment the seller confirms receipt.
          </p>
          <p className="text-muted-foreground text-xs">
            Photo evidence of the damage is required. Damage must be visible and clearly related to
            transit, not pre-existing.
          </p>
        </Section>
      </div>

      {/* Not covered */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden />
          <h2 className="text-lg font-bold">What&apos;s not covered</h2>
        </div>
        <ul className="space-y-2.5">
          {[
            'Changed your mind after purchase (buyer\'s remorse)',
            'Item matches the description but you expected something different',
            'Damage you caused after receiving the item',
            'Local pickup orders — protection requires tracked shipping',
            'Payments made outside Reswell (e.g. Venmo, cash, bank transfer)',
            'Claims filed more than 30 days after confirmed delivery',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-neutral-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* How to file */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle className="h-5 w-5 text-foreground flex-shrink-0" aria-hidden />
          <h2 className="text-lg font-bold">How to file a claim</h2>
        </div>
        <ol className="space-y-3">
          {[
            'Go to your order in Purchases.',
            'Tap "File a protection claim."',
            'Select what happened and describe the issue in detail.',
            'Upload photos, screenshots, or tracking information as evidence.',
            'Submit — we\'ll review your claim within 3 business days.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-4 pt-4 border-t">
          <Link
            href="/dashboard/purchases"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Go to my orders
          </Link>
        </div>
      </div>

      {/* Protection window */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 p-6">
        <h2 className="text-base font-bold text-blue-900 dark:text-blue-300 mb-2">
          Protection window
        </h2>
        <div className="space-y-2 text-sm text-blue-800/80 dark:text-blue-400/80">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p>
              <strong>Opens</strong> when your order is placed.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p>
              <strong>Closes</strong> 30 days after delivery confirmation — or when you leave a
              positive review, whichever comes first.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <p>
              You can see the exact countdown on your order detail page while protection is active.
            </p>
          </div>
        </div>
      </div>

      {/* Fund model — brief note for transparency */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="text-base font-bold mb-2">How protection is funded</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Reswell funds buyer protection directly from our 7% platform fee — no extra charges
          to sellers, ever. When you sell on Reswell, you keep 93% of your sale price. That&apos;s
          it. No hidden fees, no protection fund deductions, no surprises. Reswell funds all
          buyer protection from our platform fee — it&apos;s included in the marketplace service.
        </p>
      </div>

      {/* Contact */}
      <div className="text-center space-y-2 text-sm text-muted-foreground">
        <p>Questions about a claim or this policy?</p>
        <Link
          href="/contact"
          className="text-foreground font-medium hover:underline underline-offset-2"
        >
          Contact us →
        </Link>
      </div>
    </div>
  )
}
