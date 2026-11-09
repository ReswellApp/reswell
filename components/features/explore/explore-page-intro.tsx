import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { exploreBoardShapeLinks, exploreDestinations } from "@/lib/explore-page"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { cn } from "@/lib/utils"

export function ExplorePageIntro() {
  return (
    <>
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Marketplace
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Explore Reswell
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Surfboards, gear, brands, sellers, and cities — pick a place to start.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-background" aria-labelledby="explore-destinations-heading">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-14">
          <h2 id="explore-destinations-heading" className="text-2xl font-bold">
            Browse
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exploreDestinations.map((destination) => (
              <li key={destination.href}>
                <Link
                  href={destination.href}
                  prefetch={boardsBrowseLinkPrefetch(destination.href)}
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border border-border/70 bg-background p-5",
                    "transition-colors hover:border-foreground/20 hover:bg-offwhite",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-foreground">{destination.label}</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 text-sm text-pretty text-muted-foreground">{destination.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border/60" aria-labelledby="explore-shapes-heading">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="explore-shapes-heading" className="text-2xl font-bold">
                Surfboards by shape
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Jump into a board style.</p>
            </div>
            <Link
              href="/boards"
              prefetch={boardsBrowseLinkPrefetch("/boards")}
              className="inline-flex items-center text-sm font-medium text-foreground hover:text-cerulean"
            >
              All surfboards
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {exploreBoardShapeLinks.map((shape) => (
              <li key={shape.href}>
                <Link
                  href={shape.href}
                  prefetch={boardsBrowseLinkPrefetch(shape.href)}
                  className="inline-flex rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-offwhite"
                >
                  {shape.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
