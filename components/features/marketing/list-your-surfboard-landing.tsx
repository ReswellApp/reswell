import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { Button } from "@/components/ui/button"
import {
  HomeListingScrollRow,
  HomePeerListingScrollTile,
  type HomePeerScrollListing,
} from "@/components/features/home"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"

export type ListYourSurfboardLandingProps = {
  heroSlideUrls: string[]
  featuredBoards: HomePeerScrollListing[]
  featuredRecentlySold: HomePeerScrollListing[]
  userId: string | null
  favoritedIds: string[]
}

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
            <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] md:leading-tight">
              One board too many? Sell it. Trade it. Pass it on.
            </h1>
            <p className="mt-5 text-pretty text-lg font-semibold text-foreground sm:text-xl">
              Reswell. The marketplace built for surfers, by surfers.
            </p>
            <p className="mt-3 text-pretty text-base text-muted-foreground sm:text-lg">
              List yours in under a minute.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="/sell">
                  List your surfboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {featuredRecentlySold.length > 0 ? (
        <section className="scroll-mt-24 py-10 sm:py-16">
          <div className="container mx-auto">
            <ListingSectionHeader title="Recently sold surfboards" href="/sell" ctaLabel="List a board" />
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
      ) : null}

      {featuredBoards.length > 0 ? (
        <section className="scroll-mt-24 py-10 sm:py-16">
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
      ) : null}
    </main>
  )
}
