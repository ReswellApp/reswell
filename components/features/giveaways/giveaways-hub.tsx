import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { FadeInSection } from "@/components/fade-in-section"
import { GiveawayHero } from "@/components/features/giveaways/giveaway-hero"
import { GiveawaysDirectory } from "@/components/features/giveaways/giveaways-directory"
import { Button } from "@/components/ui/button"
import {
  giveawayPrizeBrandsFor,
  isGiveawayOpen,
} from "@/lib/giveaways/catalog"
import { giveawayDetailHref } from "@/lib/giveaways/paths"
import type { Giveaway } from "@/lib/types/giveaways"

const PROOF_POINTS = [
  { label: "Free to enter", detail: "Just list a board" },
  { label: "You pick", detail: "Six custom brands" },
  { label: "No sale needed", detail: "Listing is the ticket" },
] as const

type GiveawaysHubProps = {
  giveaways: Giveaway[]
}

function daysLeftLabel(endsAt: string): string | null {
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(end)) return null
  const days = Math.ceil((end - Date.now()) / 86_400_000)
  if (days <= 0) return null
  return days === 1 ? "1 day left to enter" : `${days} days left to enter`
}

export function GiveawaysHub({ giveaways }: GiveawaysHubProps) {
  const featured = giveaways.find((giveaway) => isGiveawayOpen(giveaway)) ?? giveaways[0]
  if (!featured) {
    return <GiveawaysDirectory giveaways={giveaways} />
  }

  const brands = giveawayPrizeBrandsFor(featured)
  const enterHref = giveawayDetailHref(featured.slug, { hash: "enter" })
  const moreGiveaways = giveaways.filter((giveaway) => giveaway.slug !== featured.slug)
  const daysLeft = daysLeftLabel(featured.endsAt)

  return (
    <>
      <GiveawayHero giveaway={featured}>
        {daysLeft ? (
          <p className="mt-4 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {daysLeft}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" className="h-12 rounded-full px-6" asChild>
            <Link href={enterHref}>
              Enter the raffle
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Link
            href="#how-to-enter"
            className="text-center text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline sm:text-left"
          >
            How it works
          </Link>
        </div>
      </GiveawayHero>

      <section className="relative z-10 -mt-6 rounded-t-3xl bg-background sm:-mt-8">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <FadeInSection>
            <div className="grid grid-cols-3 gap-3">
              {PROOF_POINTS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-foreground/10 bg-offwhite px-3 py-4 text-center sm:px-4"
                >
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.detail}</p>
                </div>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection className="mt-12">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              The custom you could win
            </h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              One raffle. One custom. You choose the brand — they shape it to
              your specs.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={giveawayDetailHref(featured.slug, {
                      brand: brand.id,
                      hash: "enter",
                    })}
                    className="flex h-full flex-col rounded-2xl border border-foreground/15 bg-white px-4 py-4 transition-colors hover:border-foreground/30 hover:bg-neutral-50/80"
                  >
                    <p className="font-semibold text-foreground">{brand.name}</p>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {brand.tagline}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </FadeInSection>

          <FadeInSection className="mt-12">
            <section id="how-to-enter" className="scroll-mt-28">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How to enter
              </h2>
              <ol className="mt-6 grid gap-3 sm:grid-cols-3">
                {featured.howItWorks.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-2xl border border-foreground/10 bg-offwhite px-4 py-5"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-listingHeart text-sm font-semibold text-white"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <p className="mt-3 font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </FadeInSection>

          <FadeInSection className="mt-12">
            <div className="rounded-3xl border border-foreground/15 bg-offwhite px-6 py-8 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-listingHeart">
                {featured.scheduleLabel}
              </p>
              <h2 className="mt-3 font-headline text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                List a surfboard. You&apos;re in.
              </h2>
              <p className="mt-2 max-w-md text-pretty text-muted-foreground">
                {featured.summary}
              </p>
              <Button size="lg" className="mt-6 h-12 rounded-full px-6" asChild>
                <Link href={enterHref}>
                  Enter the raffle
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </FadeInSection>

          {moreGiveaways.length > 0 ? (
            <div className="mt-12">
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground">
                More raffles
              </h2>
              <GiveawaysDirectory giveaways={moreGiveaways} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
