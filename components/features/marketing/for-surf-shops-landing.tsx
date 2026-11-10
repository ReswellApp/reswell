import Image from "next/image"
import Link from "next/link"
import { BadgePercent, MapPinned, Store } from "lucide-react"
import { FadeInSection } from "@/components/fade-in-section"
import { ForSurfShopsFaq } from "@/components/features/marketing/for-surf-shops-faq"
import { ForSurfShopsPartnerForm } from "@/components/features/marketing/for-surf-shops-partner-form"
import { HowToSellSection } from "@/components/features/seller-resources/how-to-sell-section"
import { SellerResourcesCta } from "@/components/features/seller-resources/seller-resources-cta"
import { SellerResourcesHowCard } from "@/components/features/seller-resources/seller-resources-how-card"
import { SellerResourcesValueStrip } from "@/components/features/seller-resources/seller-resources-value-strip"
import { Button } from "@/components/ui/button"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"
import {
  FOR_SURF_SHOPS_FIT,
  FOR_SURF_SHOPS_HERO_DESCRIPTION,
  FOR_SURF_SHOPS_OFFER,
  FOR_SURF_SHOPS_OFFER_ANCHOR,
  FOR_SURF_SHOPS_OFFER_MONTHS,
  FOR_SURF_SHOPS_STEPS,
  FOR_SURF_SHOPS_USES,
  FOR_SURF_SHOPS_VALUES,
  FOR_SURF_SHOPS_WHY,
  forSurfShopsAccountHref,
  forSurfShopsAccountLabel,
  forSurfShopsOfferHref,
  forSurfShopsOfferLabel,
  forSurfShopsSignInHref,
} from "@/lib/for-surf-shops"
import { MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import { wideShimmer } from "@/lib/image-shimmer"
import heroAtmosphere from "@/public/images/brand/boards-shaper-workshop.jpg"
import storyAtmosphere from "@/public/images/careers/role-shop.jpg"

const VALUE_ICONS = {
  fee: BadgePercent,
  reach: MapPinned,
  shop: Store,
} as const

export function ForSurfShopsLanding({ signedIn }: { signedIn: boolean }) {
  const accountHref = forSurfShopsAccountHref(signedIn)
  const accountLabel = forSurfShopsAccountLabel(signedIn)
  const offerHref = forSurfShopsOfferHref()
  const offerLabel = forSurfShopsOfferLabel()

  return (
    <main className="flex-1 bg-white">
      <section className="relative isolate min-h-[100svh] w-full overflow-hidden">
        <Image
          src={heroAtmosphere}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover object-[center_40%] for-surf-shops-hero-media"
          placeholder="blur"
          blurDataURL={wideShimmer}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#04070E]/55 via-[#001A4A]/72 to-[#04070E]/88"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
          <div className="for-surf-shops-hero-copy max-w-2xl">
            <p className="font-headline text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Reswell
            </p>
            <h1 className="mt-4 font-headline text-[clamp(2.15rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-white">
              Six months.
              <br />
              No selling fees.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              {FOR_SURF_SHOPS_HERO_DESCRIPTION}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white px-8 font-semibold text-[#001A4A] hover:bg-white/90"
              >
                <Link href={offerHref}>{offerLabel}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/40 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#why-reswell">Why we built this</Link>
              </Button>
            </div>
            {!signedIn ? (
              <p className="mt-5 text-sm text-white/70">
                Already selling on Reswell?{" "}
                <Link
                  href={forSurfShopsSignInHref()}
                  className="font-medium text-white underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                then apply so we can attach the offer to your shop.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <SellerResourcesValueStrip
        items={FOR_SURF_SHOPS_VALUES.map((item) => ({
          icon: VALUE_ICONS[item.key],
          title: item.title,
          body: item.body,
        }))}
      />

      <FadeInSection>
        <section id="why-reswell" className="border-b border-border/70 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="order-2 overflow-hidden lg:order-1">
              <Image
                src={storyAtmosphere}
                alt="Surfboards lined up inside a surf shop"
                width={1600}
                height={1200}
                sizes="(max-width: 1024px) 100vw, 560px"
                className="h-auto w-full object-cover for-surf-shops-story-media"
                placeholder="blur"
                blurDataURL={wideShimmer}
                quality={90}
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
                {FOR_SURF_SHOPS_WHY.eyebrow}
              </p>
              <h2 className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
                {FOR_SURF_SHOPS_WHY.title}
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-[#5c6b89] sm:text-lg">
                {FOR_SURF_SHOPS_WHY.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <HowToSellSection
          wash
          eyebrow={FOR_SURF_SHOPS_FIT.eyebrow}
          title={FOR_SURF_SHOPS_FIT.title}
          lead={FOR_SURF_SHOPS_FIT.lead}
        >
          <ul className="mx-auto grid max-w-4xl gap-10 md:grid-cols-3">
            {FOR_SURF_SHOPS_FIT.points.map((point) => (
              <li key={point.title} className="text-center md:text-left">
                <p className="text-lg font-bold tracking-tight text-[#001A4A]">{point.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{point.body}</p>
              </li>
            ))}
          </ul>
        </HowToSellSection>
      </FadeInSection>

      <FadeInSection>
        <section
          id={FOR_SURF_SHOPS_OFFER_ANCHOR}
          className="scroll-mt-24 bg-[#001A4A] px-4 py-14 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7F9DD5]">
              {FOR_SURF_SHOPS_OFFER.eyebrow}
            </p>
            <h2 className="mt-3 font-headline text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {FOR_SURF_SHOPS_OFFER.title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/80 sm:text-lg">
              {FOR_SURF_SHOPS_OFFER.lead}
            </p>
            <div className="mt-10 flex flex-wrap items-end justify-center gap-8 sm:gap-14">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                  Standard fee
                </p>
                <p className="mt-2 font-headline text-4xl font-bold text-white/45 line-through decoration-white/35 sm:text-5xl">
                  {MARKETPLACE_FEE_PERCENT}%
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7F9DD5]">
                  Shop offer · {FOR_SURF_SHOPS_OFFER_MONTHS} months
                </p>
                <p className="mt-2 font-headline text-5xl font-bold text-white sm:text-6xl">0%</p>
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed text-white/65">
              {FOR_SURF_SHOPS_OFFER.after}
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="mb-6 text-center">
              <h3 className="font-headline text-2xl font-bold tracking-tight text-white">
                Apply to claim the offer
              </h3>
              <p className="mt-2 text-sm text-white/70">
                Reach out first — we verify your shop, then unlock zero selling fees. Faster and
                safer than a public promo code.
              </p>
            </div>
            <ForSurfShopsPartnerForm />
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <HowToSellSection
          eyebrow="How it works"
          title="From apply to your first listing"
          lead="Built for shops moving more than one board — same Sell flow every Reswell seller uses."
        >
          <ol className="space-y-5">
            {FOR_SURF_SHOPS_STEPS.map((step, index) => (
              <SellerResourcesHowCard key={step.title} step={index + 1} title={step.title}>
                {step.body}
              </SellerResourcesHowCard>
            ))}
          </ol>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#5c6b89]">
            Shops in Santa Barbara can drop a sold board off and Reswell packs and ships it.{" "}
            <Link
              href={SANTA_BARBARA_DROPOFF_HREF}
              className="font-medium text-[#001A4A] underline underline-offset-4"
            >
              How drop-off works
            </Link>
          </p>
        </HowToSellSection>
      </FadeInSection>

      <FadeInSection>
        <HowToSellSection wash eyebrow="What to list" title="Boards that belong on Reswell">
          <ul className="grid gap-8 md:grid-cols-3">
            {FOR_SURF_SHOPS_USES.map((item) => (
              <li key={item.title}>
                <p className="text-xl font-bold tracking-tight text-[#001A4A]">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5c6b89]">{item.body}</p>
              </li>
            ))}
          </ul>
        </HowToSellSection>
      </FadeInSection>

      <FadeInSection>
        <HowToSellSection
          eyebrow="Questions"
          title={signedIn ? "Selling from the shop" : "Before you apply"}
          className="bg-[#E8EEF8]"
        >
          <ForSurfShopsFaq />
        </HowToSellSection>
      </FadeInSection>

      <SellerResourcesCta
        title={signedIn ? "List the next board" : "Ready when your offer is live"}
        description={
          signedIn
            ? "Applied already? Keep listing — we'll attach the fee waiver to your shop."
            : "Apply above for six months free, or create an account and list while we confirm your shop."
        }
        href={signedIn ? accountHref : offerHref}
        label={signedIn ? accountLabel : offerLabel}
      />
    </main>
  )
}
