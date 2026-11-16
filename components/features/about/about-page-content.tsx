import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ChevronRight } from "lucide-react"
import { AboutFoundersSection } from "@/components/features/about/about-founders-section"
import {
  MarketingHeadlineHero,
  marketingHeadlineTitleClass,
} from "@/components/features/marketing/marketing-headline-hero"
import { Button } from "@/components/ui/button"
import { RESWELL_CONTACT_EMAIL, RESWELL_CONTACT_MAILTO } from "@/lib/constants/contact"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import { shimmerDataUrl } from "@/lib/image-shimmer"
import { reswellProtectionCardClassName } from "@/lib/reswell-protection-surface"
import aboutHeadlineAtmosphere from "@/public/images/about/headline-oz-aerial.jpg"
import ourStoryBeachFilm from "@/public/images/about/our-story-beach-film.jpg"

const WHY_SURFERS_USE = [
  {
    title: "Nationwide, with shipping",
    href: SURFBOARD_SELL_BOARDS_CREATE_HREF,
    description:
      "List a board once and reach surfers outside your zip code. Built in shipping means the deal doesn't stop at local pickup.",
  },
  {
    title: "One place for the board you want",
    href: "/boards",
    description:
      "Used boards and gear sit scattered across apps and shop floors. Reswell is a dedicated marketplace so searching and selling stays in one spot.",
  },
  {
    title: "Purchase Protection",
    href: "/protection-policy",
    description:
      "Eligible checkout purchases are covered for buyers when something goes wrong. Sellers aren't charged an extra protection fee.",
  },
  {
    title: "Buy and sell on the site",
    href: "/boards",
    description:
      "Message the other person, agree on a price, and check out on Reswell. Shipping is built in when local pickup isn't the right fit.",
  },
] as const

const WHO_ITS_FOR = [
  {
    title: "Surfers who know what they want",
    body: "If your local options are thin, even outside the deep inventory of Southern California, you shouldn't have to settle. Browse boards from across the country.",
  },
  {
    title: "People who buy and sell often",
    body: "Trying a lot of setups, rotating a quiver, or selling boards on the side. Reswell is meant to feel professional enough for that kind of volume.",
  },
  {
    title: "Sellers who want a wider audience",
    body: "A board that sits for months on a local listing might be exactly what someone elsewhere is hunting for. We help you reach them.",
  },
  {
    title: "Buyers and sellers who care about trust",
    body: "Checkout stays on Reswell when it counts. Purchase Protection and clear rules are how we try to make the exchange feel fair on both sides.",
  },
] as const

export type AboutPageStats = {
  soldCountLabel: string
  gmvLabel: string
  activeListingsLabel: string
}

type AboutPageContentProps = {
  stats: AboutPageStats
  heroListingImages: readonly string[]
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-headline text-3xl font-bold tracking-tight text-listingHeart sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function AboutPageContent({ stats, heroListingImages }: AboutPageContentProps) {
  return (
    <>
      <MarketingHeadlineHero
        heroListingImages={heroListingImages}
        atmosphereImage={aboutHeadlineAtmosphere}
        hideBoardStack
        headline={
          <h1 className={marketingHeadlineTitleClass}>
            Connecting surfers nationwide to buy and sell{" "}
            <span className="text-listingHeart">surfboards</span>
          </h1>
        }
      />

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
          <div className="order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0">
            <div className="overflow-hidden rounded-[2rem] border border-border/80 bg-white shadow-sm">
              <Image
                src={ourStoryBeachFilm}
                alt="Film photograph of a breaking wave on a sandy beach"
                width={2000}
                height={2000}
                sizes="(max-width: 1024px) 100vw, 448px"
                className="h-auto w-full"
                placeholder="blur"
                blurDataURL={shimmerDataUrl(800, 800)}
                quality={90}
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Our story
            </h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>
                Welcome to Reswell! As lifelong surfers, we know the troubles that come with buying and
                selling surfboards. We&apos;ve all been there: scrolling Facebook Marketplace, refreshing
                Craigslist, messaging strangers who never reply, and meeting up in parking lots hoping
                the ding they mentioned really is &ldquo;minor.&rdquo; Surfboards are sacred to us, and
                these sites just don&apos;t do justice to them.
              </p>
              <p>
                To do right by our passion for surfing, we created a peer-to-peer marketplace dedicated
                to surfboards and surf gear. Everything we&apos;ve built comes back to trust and
                community. Every transaction comes with purchase protection, so you&apos;re covered if a
                board doesn&apos;t show up as promised. Detailed listings give you the dimensions and
                condition up front, so you know exactly what you&apos;re getting. Profiles backed with
                strong reviews mean you&apos;re never buying from a stranger. Our simple, easy-to-use
                interface ties it all together so you can spend less time searching for surfboards and
                more time riding them.
              </p>
              <p>
                We&apos;re based in Santa Barbara, CA and feel lucky to be surrounded by a strong surf
                culture with a lot of quality surfboards. We simply want to share this feeling with
                others. Whether you&apos;re filling a gap in your quiver or buying and selling as a side
                hustle, you&apos;ve found your spot.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AboutFoundersSection />

      <section className="border-b border-border/70 bg-[#F9F9F2]">
        <div className="container mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="font-headline text-[clamp(1.65rem,3.5vw,2.5rem)] font-bold uppercase leading-tight tracking-tight text-foreground">
            Find the board.
            <br />
            Sell it farther.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            We want buyers to get the boards and gear they&apos;re looking for, and sellers to reach more
            surfers and move boards faster. Nationwide, with shipping built in, and a community
            grounded in trust.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/boards">
                Browse boards
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={SURFBOARD_SELL_BOARDS_CREATE_HREF}>List a board</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            <StatCell value={stats.soldCountLabel} label="items sold on Reswell" />
            <StatCell value={stats.gmvLabel} label="in completed sales" />
            <StatCell value={stats.activeListingsLabel} label="listings live right now" />
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-center font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What we&apos;re building toward
          </h2>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
            {WHY_SURFERS_USE.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border/80 bg-card px-5 py-5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className={`mx-auto max-w-3xl rounded-[1.75rem] ${reswellProtectionCardClassName} p-8 sm:p-10`}>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              Purchase Protection is central to what we do
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Trust is the most important part of this business.{" "}
                <Link
                  href="/protection-policy"
                  className="text-foreground underline underline-offset-4"
                >
                  Purchase Protection
                </Link>{" "}
                is how we stand behind eligible purchases paid through Reswell checkout.
              </p>
              <p>
                For buyers, that means coverage when something covered goes wrong: the item never
                arrives, isn&apos;t as described in a material way, or arrives damaged in transit. When a
                claim is approved, there is a path to a refund. There&apos;s no extra protection fee on
                eligible purchases.
              </p>
              <p>
                For sellers, eligible sales are under the same program, and you aren&apos;t charged an
                additional protection fee on your payout. Claims follow a clear policy, we review
                them with the evidence on record, and returns (when required) use a documented flow
                with tracking.
              </p>
            </div>
            <Link
              href="/protection-policy"
              className="mt-6 inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Read the full protection policy
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-center font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Who Reswell is for
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
            We&apos;re early. We&apos;re working on this every day, honestly, and without the flash.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHO_ITS_FOR.map(({ title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/80 bg-card p-6 text-center sm:text-left"
              >
                <p className="font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-14 max-w-2xl rounded-[1.75rem] border border-border/80 bg-muted/30 px-6 py-8 text-center sm:px-10">
            <p className="text-base leading-relaxed text-muted-foreground">
              Questions or something that doesn&apos;t look right? Tell us.{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-4">
                Contact us
              </Link>{" "}
              or email{" "}
              <a href={RESWELL_CONTACT_MAILTO} className="text-foreground underline underline-offset-4">
                {RESWELL_CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
