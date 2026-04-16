import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ShieldCheck,
  Package,
  Tag,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { pageSeoMetadata } from '@/lib/site-metadata'

export const metadata: Metadata = pageSeoMetadata({
  title: 'Purchase Protection — Reswell',
  description:
    'Purchase Protection for buyers and sellers on Reswell: buyer refunds for covered problems on eligible orders; sellers are not charged extra for protection — policy, exclusions, and claims.',
  path: '/protection-policy',
})

function Section({
  icon: Icon,
  iconColor = 'text-blue-600 dark:text-blue-400',
  bg = 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40',
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
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-5">
            <ShieldCheck className="h-10 w-10 text-blue-600 dark:text-blue-400" aria-hidden />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reswell Purchase Protection
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-base">
          Purchase Protection covers <strong>buyers</strong> on eligible orders paid through Reswell
          checkout. This page also explains what <strong>sellers</strong> can expect — fair rules,
          no extra protection fees on your payouts, and how claims work when a buyer opens one.
        </p>
      </div>

      {/* Buyer protections — overview */}
      <section
        id="buyer-protections"
        aria-labelledby="buyer-protections-heading"
        className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 p-6 scroll-mt-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden />
          <h2 id="buyer-protections-heading" className="text-lg font-bold text-foreground">
            Buyer protections
          </h2>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Purchase Protection is for <strong>buyers</strong>: people who buy items on Reswell and
          complete payment in the app. It is how we stand behind your purchase when something goes
          wrong in a covered scenario — you do not pay an extra fee for this coverage on eligible
          orders.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed mt-3">
          <strong>What buyers get when a claim is approved:</strong>
        </p>
        <ul className="mt-2 space-y-2 text-sm text-foreground/80">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden />
            <span>
              <strong>Money back</strong> — a full refund of the item price and shipping you paid
              for that order (no separate protection cap on covered claims).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden />
            <span>
              <strong>Covered problems</strong> — non-delivery, item not as described (material
              mismatch), or damage in transit (with required evidence where stated below).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" aria-hidden />
            <span>
              <strong>Returns when required</strong> — for not-as-described and damage claims, we
              provide a prepaid return label; your refund is released after the seller confirms
              receipt.
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          <strong>Eligibility:</strong> Protection applies to eligible orders only — for example, it
          requires checkout and payment on Reswell, tracked shipping for covered shipment claims
          (not local pickup), and filing within the protection window. See{' '}
          <a href="#not-covered" className="font-medium text-foreground underline underline-offset-2">
            What&apos;s not covered
          </a>{' '}
          and{' '}
          <a href="#protection-window" className="font-medium text-foreground underline underline-offset-2">
            Protection window
          </a>
          .
        </p>
      </section>

      {/* Seller protections — overview */}
      <section
        id="seller-protections"
        aria-labelledby="seller-protections-heading"
        className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-6 scroll-mt-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <Store className="h-5 w-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" aria-hidden />
          <h2 id="seller-protections-heading" className="text-lg font-bold text-foreground">
            Seller protections
          </h2>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          When you sell on Reswell, eligible orders are still covered by the same Purchase
          Protection program — but <strong>you are not charged an additional fee</strong>{' '}for it.
          Reswell funds approved buyer refunds from our marketplace fee; your agreed seller share
          (93% of the sale price) is not reduced by a separate &ldquo;protection&rdquo; line item. See{' '}
          <a href="#how-funded" className="font-medium text-foreground underline underline-offset-2">
            How protection is funded
          </a>
          .
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed mt-3">
          <strong>What sellers can rely on:</strong>
        </p>
        <ul className="mt-2 space-y-2 text-sm text-foreground/80">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <span>
              <strong>Claims are limited to the policy</strong> — buyer&apos;s remorse, subjective
              expectations, and off-platform payments are out of scope. &ldquo;Not as described&rdquo;
              requires a <strong>material</strong>{' '}mismatch with the listing; minor issues that
              weren&apos;t represented may not qualify.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <span>
              <strong>Review before outcomes</strong> — we aim to review protection claims within{' '}
              <strong>3 business days</strong>, using the evidence submitted (photos, tracking,
              messages). Outcomes follow this policy and what the record shows.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <span>
              <strong>Returns when required</strong> — for covered not-as-described or damage
              claims, we issue a prepaid return label to the buyer. Refunds to the buyer complete
              after <strong>you confirm you received the return</strong>, so legitimate returns are
              handled through a clear, documented flow.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
            <span>
              <strong>Tracking protects everyone</strong> — for shipped orders, use{' '}
              <strong>tracked shipping</strong> and add tracking to the order. It helps show
              delivery status and is required for protection on shipped orders (see exclusions for
              local pickup).
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Manage your sales, tracking, and buyer messages from{' '}
          <Link href="/dashboard/sales" className="font-medium text-foreground underline underline-offset-2">
            Sales
          </Link>
          . If a buyer opens a claim, respond promptly in the order thread with accurate information
          so we can review fairly.
        </p>
      </section>

      {/* Coverage sections (buyer remedies — detail) */}
      <p className="text-center text-sm text-muted-foreground -mb-2">
        The sections below describe <strong className="text-foreground/90">buyer remedies</strong>{' '}
        for covered problems. Sellers should ship as described, use tracking for shipped orders,
        and cooperate with returns when this policy applies.
      </p>
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
      <div id="not-covered" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 scroll-mt-8">
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
          {(
            [
              <>
                Go to <strong>Orders</strong> (
                <Link href="/dashboard/orders" className="font-medium text-foreground underline underline-offset-2">
                  /dashboard/orders
                </Link>
                ).
              </>,
              <>Open the order you need help with.</>,
              <>
                Tap <strong>Refund help</strong>. Say whether you&apos;ve already messaged the seller,
                then describe what happened in <strong>What should we know?</strong> — include
                tracking numbers, dates, and clear details. Our team may email you if we need photos
                or more information (there isn&apos;t a separate upload step in the form today).
              </>,
              <>
                Tap <strong>Submit to support</strong>. We aim to review within{' '}
                <strong>3 business days</strong>.
              </>,
              <>
                For general questions to Reswell that aren&apos;t a refund issue on this order, use{' '}
                <strong>Ask Reswell</strong> on the same order page instead.
              </>,
            ] as const
          ).map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          <strong>Refund help</strong> and <strong>Ask Reswell</strong> show on the order page while
          the order is <strong>confirmed</strong> and a refund isn&apos;t already processing or
          completed.
        </p>
        <div className="mt-4 pt-4 border-t">
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Go to my orders
          </Link>
        </div>
      </div>

      {/* Protection window */}
      <div
        id="protection-window"
        className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 p-6 scroll-mt-8"
      >
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
      <div
        id="how-funded"
        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 scroll-mt-8"
      >
        <h2 className="text-base font-bold mb-2">How protection is funded</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Reswell funds buyer protection from our 7% marketplace fee. Sellers keep 93% of the
          sale price; there are no separate protection surcharges or deductions from seller payouts
          for this program.
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
