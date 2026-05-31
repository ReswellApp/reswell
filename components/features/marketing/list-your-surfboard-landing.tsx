import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Landmark,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Truck,
} from "lucide-react"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FadeInSection } from "@/components/fade-in-section"
import {
  ListYourSurfboardSellCta,
  ListYourSurfboardSellSectionHeader,
} from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { ListYourSurfboardStickyCta } from "@/components/features/marketing/list-your-surfboard-sticky-cta"
import {
  HomeListingScrollRow,
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home"
import {
  marketingCtaBannerCtaLabelClassName,
  marketingCtaBannerDescriptionClassName,
  marketingCtaBannerPanelClassName,
  marketingCtaBannerTitleClassName,
} from "@/components/marketing-cta-banners"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { portraitShimmer } from "@/lib/image-shimmer"
import { MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"
import { STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE } from "@/lib/utils/stripe-connect-cashout"
import { cn } from "@/lib/utils"

export type ListYourSurfboardLandingProps = {
  heroSlideUrls: string[]
  featuredBoards: HomePeerScrollListing[]
  featuredRecentlySold: HomePeerScrollListing[]
  userId: string | null
  favoritedIds: string[]
}

const INSTANT_PAYOUT_FEE_PERCENT = (STRIPE_INSTANT_BANK_PAYOUT_FEE_RATE * 100).toFixed(1)

const VALUE_PROPS = [
  {
    title: "Built for surfers, by surfers",
    body: "Listings built around what matters — shape, volume, fin setup, and condition. Buyers here know boards, not just prices.",
    mobileBody: "Shape, volume, fins, condition. Buyers here know boards.",
  },
  {
    title: "Free to list",
    body: `Listing never costs a thing. Reswell only charges a small ${MARKETPLACE_FEE_PERCENT}% marketplace fee when your board actually sells — never before.`,
    mobileBody: `Always free. Just a ${MARKETPLACE_FEE_PERCENT}% fee when it sells.`,
  },
  {
    title: "Reach real buyers",
    body: "Your board lands in front of a community actively hunting for their next ride — locally and from sellers who ship.",
    mobileBody: "Land in front of surfers hunting for their next board.",
  },
  {
    title: "Shipping made easy",
    body: "Offer local pickup, shipping, or both. Reswell can generate a discounted label with tracking so the handoff is painless.",
    mobileBody: "Local pickup or shipping with a discounted, tracked label.",
  },
  {
    title: "Get paid securely",
    body: `Payments run through Stripe. When a sale clears, cash out to your bank via standard ACH or instant transfer (${INSTANT_PAYOUT_FEE_PERCENT}% fee) when available.`,
    mobileBody: "Secure Stripe payouts, straight to your bank.",
  },
  {
    title: "Backed by Purchase Protection",
    body: "Shipped orders are covered end to end. Buyers shop with confidence, which means your listings sell faster.",
    mobileBody: "Shipped orders covered end to end — sells faster.",
  },
] as const

const SELL_STEPS = [
  {
    n: "01",
    icon: Camera,
    imageSrc: "/images/home/how-it-works-sell-list.png",
    imageAlt: "Surfer in a wetsuit riding a wave, black and white",
    title: "List in under a minute",
    body: "Snap a few photos, add condition, dimensions, and your price. Our AI helper can draft the description for you.",
    mobileBody: "Snap photos, set a price. AI drafts the rest.",
  },
  {
    n: "02",
    icon: MessageCircle,
    imageSrc: "/images/home/how-it-works-sell-connect.png",
    imageAlt: "Aerial view of a coastline at sunset with surfers in the lineup",
    title: "Connect with buyers",
    body: "Messages, questions, and offers all land in one place. Agree on pickup or ship it out — your call.",
    mobileBody: "Messages and offers in one place. Pickup or ship.",
  },
  {
    n: "03",
    icon: Landmark,
    imageSrc: "/images/home/how-it-works-sell-paid.png",
    imageAlt: "Surfer turning on a large green wave with spray",
    title: "Get paid directly",
    body: `Once the order clears, your earnings are ready. Cash out via ACH or choose instant transfer (${INSTANT_PAYOUT_FEE_PERCENT}% fee) when you want funds sooner.`,
    mobileBody: "Sale clears, cash out to your bank.",
  },
] as const

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Purchase Protection",
    body: "Shipped orders are covered against not-as-described and transit damage — funded by the marketplace fee, not charged to you.",
    mobileBody: "Shipped orders covered, funded by us.",
  },
  {
    icon: Landmark,
    title: "Secure payouts",
    body: `Powered by Stripe Connect. Standard ACH cash outs typically arrive in 2–3 business days. Instant transfer is available for a ${INSTANT_PAYOUT_FEE_PERCENT}% fee when your bank supports it.`,
    mobileBody: "Secure Stripe payouts to your bank.",
  },
  {
    icon: Truck,
    title: "Ship with tracking",
    body: "Generate a discounted label with tracking right from your sale page so delivery is confirmed automatically.",
    mobileBody: "Discounted, tracked shipping labels.",
  },
  {
    icon: MapPin,
    title: "Safe local pickup",
    body: "Prefer to meet up? Coordinate in Messages and confirm the handoff with a 6-digit pickup code.",
    mobileBody: "Safe local pickup with a 6-digit code.",
  },
] as const

const FAQS = [
  {
    q: "How much does it cost to list?",
    a: `Listing is completely free. Reswell only charges a ${MARKETPLACE_FEE_PERCENT}% marketplace fee on the item price when your board sells. There are no listing fees, no monthly fees, and card processing is absorbed by Reswell.`,
  },
  {
    q: "How do I get paid?",
    a: `Payments run through Stripe. After a sale clears Purchase Protection timelines (delivery confirmed or pickup verified), your earnings move to your ready balance. Cash out via standard ACH (usually 2–3 business days) or instant transfer (${INSTANT_PAYOUT_FEE_PERCENT}% fee) when available.`,
  },
  {
    q: "Do I have to ship, or can I sell locally?",
    a: "Both. When you list, choose local pickup, shipping, or both. For shipping you can use Reswell calculated rates, free shipping, or a flat rate — and Reswell can generate a label with tracking for you.",
  },
  {
    q: "What can I sell on Reswell?",
    a: "Surfboards of every flavor — shortboards, longboards, fish, grovelers, hybrids, and more. Be honest about condition and include clear photos of any dings or repairs so buyers know exactly what they're getting.",
  },
  {
    q: "Can buyers negotiate?",
    a: "Only if you want them to. Turn on offers when you create the listing and you can accept, counter, or decline. You set a minimum threshold so you never see lowball offers you wouldn't take.",
  },
] as const

function ListingSectionHeader({
  title,
  href,
  ctaLabel,
  prefetch,
}: {
  title: string
  href: string
  ctaLabel: string
  prefetch?: boolean | undefined
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 sm:mb-8">
      <h2 className="min-w-0 text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h2>
      <Button variant="outline" size="sm" className="shrink-0" asChild>
        <Link href={href} prefetch={prefetch}>
          {ctaLabel}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

/**
 * Renders trimmed copy on mobile and the full version on `sm+`. Falls back to a
 * single string when no short variant is supplied. Keeps desktop unchanged while
 * cutting reading load on phones.
 */
function ResponsiveCopy({
  full,
  short,
  className,
}: {
  full: string
  short?: string
  className?: string
}) {
  if (!short || short === full) {
    return <span className={className}>{full}</span>
  }
  return (
    <span className={className}>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </span>
  )
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  mobileSubtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  mobileSubtitle?: string
}) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <ResponsiveCopy
          full={subtitle}
          short={mobileSubtitle}
          className="mt-3.5 block text-pretty text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg"
        />
      ) : null}
    </div>
  )
}

export function ListYourSurfboardLanding({
  heroSlideUrls,
  featuredBoards,
  featuredRecentlySold,
  userId,
  favoritedIds,
}: ListYourSurfboardLandingProps) {
  return (
    <main className="flex-1">
      <section className="relative flex min-h-[max(19.5rem,51svh)] items-center overflow-hidden sm:min-h-[max(21.5rem,51svh)] md:min-h-[max(34rem,min(72svh,42rem))]">
        <HeroSlideshow
          key={heroSlideUrls.map((url) => url.trim()).join("|")}
          slides={heroSlideUrls}
        />
        <div className="absolute inset-0 z-[1] bg-white/55" aria-hidden />
        <div className="container relative z-10 mx-auto py-12 sm:py-14 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-3.5 text-black md:mb-4">
              List your surfboard — it&apos;s free
            </Badge>
            <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] md:leading-tight">
              One board too many? Sell it. Pass it on.
            </h1>
            <p className="mt-3 text-pretty text-base text-muted-foreground sm:mt-5 sm:text-lg">
              <span className="font-semibold text-foreground sm:block sm:text-xl">
                The marketplace built for surfers, by surfers.
              </span>
              <span className="mt-1 block sm:mt-3">
                List in under a minute. Reach real buyers. Get paid securely.
              </span>
            </p>
            <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-3.5">
              <ListYourSurfboardSellCta userId={userId} className="w-full sm:w-auto">
                List your surfboard
              </ListYourSurfboardSellCta>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                  Browse the marketplace
                </Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm font-medium text-foreground sm:mt-7 sm:gap-x-5 sm:gap-y-2">
              {[
                { full: "Free to list", short: "Free to list" },
                { full: "Local pickup or shipping", short: "Pickup or shipping" },
                { full: "Purchase Protection on shipped orders", short: "Purchase Protection" },
              ].map(({ full, short }) => (
                <li key={full} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-foreground/70" aria-hidden />
                  <ResponsiveCopy full={full} short={short} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {featuredRecentlySold.length > 0 ? (
        <FadeInSection>
          <section className="scroll-mt-24 bg-offwhite py-12 sm:py-16">
            <div className="container mx-auto">
              <ListYourSurfboardSellSectionHeader
                title="Recently sold surfboards"
                userId={userId}
              />
              <HomeListingScrollRow uniformCardHeights>
                {featuredRecentlySold.map((board) => (
                  <HomePeerListingScrollTile
                    key={board.id}
                    listing={board}
                    userId={userId}
                    isFavorited={favoritedIds.includes(board.id)}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}

      <FadeInSection>
        <section className="py-12 sm:py-20">
          <div className="container mx-auto">
            <SectionHeading
              eyebrow="Why Reswell"
              title="Everything you need to sell a board — in one place"
              subtitle="List with photos and board details, connect with buyers who know what they're looking at, and handle checkout, shipping, and payout from one place."
              mobileSubtitle="List, connect, and get paid — all in one place."
            />
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {VALUE_PROPS.map(({ title, body, mobileBody }) => (
                <div
                  key={title}
                  className="rounded-2xl border-[0.5px] border-foreground/20 bg-white p-5 transition-colors hover:bg-neutral-50/70 sm:p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <ResponsiveCopy
                    full={body}
                    short={mobileBody}
                    className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="py-12 sm:py-20">
          <div className="container mx-auto">
            <SectionHeading
              eyebrow="How it works"
              title="From your quiver to someone else's in three steps"
            />
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-3 lg:gap-6">
              {SELL_STEPS.map(({ n, icon: Icon, imageSrc, imageAlt, title, body, mobileBody }) => (
                <div key={title} className="flex flex-col">
                  <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/30 aspect-[16/9] sm:aspect-[4/3]">
                    <Image
                      src={imageSrc}
                      alt={imageAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      placeholder="blur"
                      blurDataURL={portraitShimmer}
                    />
                    <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-foreground backdrop-blur">
                      {n}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 sm:mt-5">
                    <Icon className="h-5 w-5 text-foreground" aria-hidden />
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  </div>
                  <ResponsiveCopy
                    full={body}
                    short={mobileBody}
                    className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-2"
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center sm:mt-10">
              <ListYourSurfboardSellCta userId={userId} className="w-full sm:w-auto">
                Start your listing
              </ListYourSurfboardSellCta>
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="py-12 sm:py-20">
          <div className="container mx-auto">
            <div className={cn(marketingCtaBannerPanelClassName, "px-5 py-8 sm:px-12 sm:py-12")}>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Getting paid
                </p>
                <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Your earnings, on your schedule
                </h2>
                <ResponsiveCopy
                  full="Listing is free. When your board sells, your earnings land in your Reswell wallet — then cash out to your bank however works best for you."
                  short="Free to list. When it sells, cash out to your bank your way."
                  className="mt-3.5 block text-pretty text-base leading-relaxed text-muted-foreground sm:mt-4"
                />
              </div>
              <ul className="mx-auto mt-6 grid max-w-4xl gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
                {[
                  {
                    title: "Standard bank transfer",
                    body: "Cash out via ACH with no extra fee. Funds typically arrive in 2–3 business days.",
                    mobileBody: "Free ACH cash out in 2–3 business days.",
                  },
                  {
                    title: "Instant transfer",
                    body: `Need it sooner? Instant transfer is available for a ${INSTANT_PAYOUT_FEE_PERCENT}% fee when your bank supports it — funds usually arrive within minutes.`,
                    mobileBody: `Instant transfer in minutes for a ${INSTANT_PAYOUT_FEE_PERCENT}% fee.`,
                  },
                  {
                    title: "No surprises",
                    body: `Reswell only charges a ${MARKETPLACE_FEE_PERCENT}% marketplace fee when a sale completes. Card processing is absorbed — never deducted from your payout.`,
                    mobileBody: `Just a ${MARKETPLACE_FEE_PERCENT}% fee on sale. No card fees.`,
                  },
                ].map(({ title, body, mobileBody }) => (
                  <li
                    key={title}
                    className="flex flex-col rounded-xl border-[0.5px] border-foreground/20 bg-offwhite p-4 text-left sm:p-5"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <ResponsiveCopy
                          full={body}
                          short={mobileBody}
                          className="mt-1 block text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-1.5"
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </FadeInSection>

      {featuredBoards.length > 0 ? (
        <FadeInSection>
          <section className="scroll-mt-24 bg-offwhite py-12 sm:py-16">
            <div className="container mx-auto">
              <ListingSectionHeader
                title="Recently added surfboards"
                href="/boards"
                ctaLabel="Find More"
                prefetch={boardsBrowseLinkPrefetch("/boards")}
              />
              <HomeListingScrollRow uniformCardHeights>
                {featuredBoards.map((board) => (
                  <HomePeerListingScrollTile
                    key={board.id}
                    listing={board}
                    userId={userId}
                    isFavorited={favoritedIds.includes(board.id)}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}

      <FadeInSection>
        <section className="py-12 sm:py-20">
          <div className="container mx-auto">
            <SectionHeading
              eyebrow="Sell with confidence"
              title="Every sale is backed, secure, and on your terms"
            />
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {TRUST_POINTS.map(({ icon: Icon, title, body, mobileBody }) => (
                <div key={title} className="flex flex-col">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border-[0.5px] border-foreground/20 bg-white text-foreground sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground sm:mt-4 sm:text-base">{title}</h3>
                  <ResponsiveCopy
                    full={body}
                    short={mobileBody}
                    className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      <FadeInSection>
        <section className="py-12 sm:py-20">
          <div className="container mx-auto max-w-3xl">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map(({ q, a }, i) => (
                <AccordionItem key={q} value={`faq-${i}`} className="border-foreground/10">
                  <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Still have questions?{" "}
              <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">
                Say hello
              </Link>{" "}
              — real surfers, happy to help.
            </p>
          </div>
        </section>
      </FadeInSection>

      <section className="pb-16 pt-4 md:pb-24">
        <div className="container mx-auto">
          <div className={cn(marketingCtaBannerPanelClassName, "px-5 py-8 sm:px-12 sm:py-10")}>
            <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className={marketingCtaBannerTitleClassName}>Ready to list your board?</p>
                <p className={marketingCtaBannerDescriptionClassName}>
                  It takes about a minute. Add a few photos, set your price, and let the community find it.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                <ListYourSurfboardSellCta userId={userId} className="w-full sm:w-auto">
                  List your surfboard
                </ListYourSurfboardSellCta>
                <Link href="/help/selling" className={cn(marketingCtaBannerCtaLabelClassName, "justify-center sm:justify-start")}>
                  Selling guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ListYourSurfboardStickyCta userId={userId} />
    </main>
  )
}
