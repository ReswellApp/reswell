import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Store,
  Waves,
} from "lucide-react"
import { FALLBACK_HOME_HERO_SLIDE_PATHS } from "@/components/hero-slideshow"
import { Button } from "@/components/ui/button"
import { portraitShimmer, shimmerDataUrl } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

const HERO_STACK_SIZE = 4

function buildHeroStackImages(listingImages: readonly string[]): string[] {
  const seen = new Set<string>()
  const stack: string[] = []

  for (const src of listingImages) {
    const trimmed = src.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    stack.push(trimmed)
    if (stack.length >= HERO_STACK_SIZE) return stack
  }

  for (const fallback of FALLBACK_HOME_HERO_SLIDE_PATHS) {
    if (stack.length >= HERO_STACK_SIZE) break
    if (seen.has(fallback)) continue
    seen.add(fallback)
    stack.push(fallback)
  }

  return stack
}

const WHY_SURFERS_LOVE = [
  {
    title: "Easy to sell",
    href: "/sell",
    description: "List with photos, set pickup or shipping, and manage offers from one place.",
  },
  {
    title: "Honest deals",
    href: "/boards",
    description: "Browse real listings from surfers and shops, with messaging built in.",
  },
  {
    title: "Purchase Protection",
    href: "/protection-policy",
    description: "Eligible checkout purchases can be covered when something goes wrong.",
  },
  {
    title: "Surfer community",
    href: "/sellers",
    description: "Meet sellers, follow shops, and keep gear moving within the lineup.",
  },
] as const

const VALUE_PILLARS = [
  {
    title: "Real support",
    body: "When you write in, a person on our team reads it. No scripts, no runaround.",
    icon: MessageCircle,
  },
  {
    title: "Second lives for boards",
    body: "Every listing is a board that still has waves left in it, waiting for the right surfer.",
    icon: Waves,
  },
  {
    title: "Trust on both sides",
    body: "Buyers ask questions. Sellers describe honestly. Checkout stays on Reswell when it counts.",
    icon: ShieldCheck,
  },
  {
    title: "Shops and locals",
    body: "Peer to peer boards sit alongside select shops, so you can browse the whole market in one spot.",
    icon: Store,
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

function AboutHeroBoardStack({ images }: { images: readonly string[] }) {
  const stackImages = buildHeroStackImages(images)

  return (
    <div className="relative mx-auto flex h-[260px] w-full max-w-xl items-end justify-center sm:h-[300px] sm:max-w-2xl lg:mx-0 lg:max-w-[34rem] lg:justify-end">
      {stackImages.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className={cn(
            "absolute overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-lg shadow-black/10",
            index === 0 && "bottom-6 left-0 z-10 h-40 w-28 rotate-[-5deg] sm:h-44 sm:w-32",
            index === 1 && "bottom-10 left-[24%] z-20 h-40 w-28 rotate-[3deg] sm:bottom-8 sm:left-[26%] sm:h-44 sm:w-32",
            index === 2 && "bottom-8 left-[50%] z-30 h-40 w-28 rotate-[-2deg] sm:bottom-6 sm:left-[52%] sm:h-44 sm:w-32",
            index === 3 && "bottom-4 right-0 z-40 h-44 w-32 rotate-[4deg] sm:bottom-2 sm:h-48 sm:w-36",
          )}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 40vw, 200px"
            placeholder="blur"
            blurDataURL={portraitShimmer}
          />
        </div>
      ))}
    </div>
  )
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function AboutPageContent({ stats, heroListingImages }: AboutPageContentProps) {
  return (
    <>
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
          <div className="overflow-hidden rounded-[2rem] bg-muted/70 px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
              <div>
                <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-bold uppercase leading-[1.05] tracking-tight text-foreground">
                  We&apos;re creating{" "}
                  <span className="text-listingHeart">the easiest</span> and{" "}
                  <span className="text-listingHeart">most enjoyable</span> place to buy and sell
                  surfboards
                </h1>
              </div>
              <AboutHeroBoardStack images={heroListingImages} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div
              className="absolute -inset-4 rounded-[2.5rem] bg-listingHeart/10 sm:-inset-6"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-white shadow-sm">
              <Image
                src="/images/home/how-it-works-sell-connect.png"
                alt="Surfers connecting on Reswell"
                width={640}
                height={480}
                className="h-auto w-full object-cover"
                placeholder="blur"
                blurDataURL={shimmerDataUrl(640, 480)}
              />
            </div>
          </div>

          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Our story
            </h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>
                Buying a used board usually means juggling DMs, Venmo, and a lot of trust. Sellers
                post a photo somewhere, answer the same questions ten times, and hope the buyer
                actually shows up. Buyers wire money or meet a stranger with no backup if the board
                is not what they expected. We built Reswell because that process breaks too often.
              </p>
              <p>
                Reswell is a marketplace for surfboards. List what you have, browse what is out there,
                message the seller, and checkout on the site when you are ready. Payments, offers,
                shipping labels, and seller payouts live in one place instead of spread across five
                apps. If a covered purchase goes wrong, there is a policy for that too.
              </p>
              <p>
                We are a small team. We use the product, we read support messages, and we ship
                fixes when something is off. The goal is not to reinvent surfing. It is to make buying
                and selling a board feel straightforward enough that you actually finish the deal.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-muted/40">
        <div className="container mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="font-headline text-[clamp(1.65rem,3.5vw,2.5rem)] font-bold uppercase leading-tight tracking-tight text-foreground">
            Reswell was built
            <br />
            for surfers by surfers
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            We know how personal a board can be. That is why we built a marketplace with messaging,
            checkout, shipping tools, and real support, so the whole deal lives in one place instead
            of scattered across apps and parking lots.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/boards">
                Browse surfboards
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sell">List your board</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            <StatCell value={stats.soldCountLabel} label="boards sold on Reswell" />
            <StatCell value={stats.gmvLabel} label="in completed sales" />
            <StatCell value={stats.activeListingsLabel} label="boards listed right now" />
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-center font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Why surfers love Reswell
          </h2>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
            {WHY_SURFERS_LOVE.map((item) => (
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
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-12">
          <div className="rounded-[1.75rem] border border-border/80 bg-muted/30 p-8 sm:p-10">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              We stand behind covered purchases
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Our support team shows up when you need help. When you buy through Reswell checkout and
              your purchase is eligible,{" "}
              <Link href="/protection-policy" className="text-foreground underline underline-offset-4">
                Purchase Protection
              </Link>{" "}
              can cover qualifying issues under the policy. Buyers do not pay extra for that. It is
              part of buying here when the sale qualifies.
            </p>
            <Link
              href="/help"
              className="mt-6 inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Explore our Help Center
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-border/80 bg-muted/30 p-8 sm:p-10">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              Keeping boards in the water
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Every board on Reswell comes from a surfer or shop that cared enough to list it
              properly. Browse locally, find shipping when it is offered, check{" "}
              <Link href="/sold" className="text-foreground underline underline-offset-4">
                recently sold
              </Link>{" "}
              boards for context, and give a favorite shape its next chapter instead of letting it
              collect dust in the garage.
            </p>
            <Link
              href="/boards"
              className="mt-6 inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Explore surfboards
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-center font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What keeps us going
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
            Reswell is still growing, and we are building it with the community, not apart from it.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PILLARS.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/80 bg-card p-6 text-center sm:text-left"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-listingHeart/10 sm:mx-0">
                  <Icon className="h-5 w-5 text-listingHeart" aria-hidden />
                </div>
                <p className="mt-4 font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-14 max-w-2xl rounded-[1.75rem] border border-border/80 bg-muted/30 px-6 py-8 text-center sm:px-10">
            <p className="text-base leading-relaxed text-muted-foreground">
              Questions, ideas, or something that does not look right? We want to hear it.{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-4">
                Contact us
              </Link>{" "}
              or email{" "}
              <a href="mailto:help@reswell.app" className="text-foreground underline underline-offset-4">
                help@reswell.app
              </a>
              . Thanks for being here. Now go find your next ride.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
