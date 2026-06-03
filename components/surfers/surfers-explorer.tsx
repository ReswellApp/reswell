"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, MapPin, User } from "lucide-react"
import { SURFERS_BASE } from "@/lib/surfers/routes"
import type { SurferRow } from "@/lib/surfers/types"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { surferMediaDisplaySrc } from "@/lib/public-media-display-src"

export function SurfersExplorer({ surfers }: { surfers: SurferRow[] }) {
  return (
    <section className="bg-background" aria-labelledby="surfers-grid-heading">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 id="surfers-grid-heading" className="sr-only">
          All surfers
        </h2>

        {surfers.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {surfers.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`${SURFERS_BASE}/${entry.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-soft transition-colors hover:border-foreground/20 hover:shadow-soft-hover sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    {entry.photo_url ? (
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-border/60 bg-background">
                        <Image
                          src={surferMediaDisplaySrc(entry.photo_url)}
                          alt=""
                          fill
                          className="object-cover object-center"
                          sizes="216px"
                          quality={90}
                          unoptimized={listingImageShouldBypassOptimization(
                            surferMediaDisplaySrc(entry.photo_url),
                          )}
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <User className="h-8 w-8" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:underline">
                        {entry.name}
                      </h3>
                      {entry.location_label ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="line-clamp-2">{entry.location_label}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {entry.short_description ? (
                    <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {entry.short_description}
                    </p>
                  ) : (
                    <p className="mt-4 flex-1 text-sm text-muted-foreground/80">Profile in directory.</p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                    <span className="text-xs text-muted-foreground">
                      {entry.about_paragraphs?.length
                        ? `${entry.about_paragraphs.length} bio ${entry.about_paragraphs.length === 1 ? "section" : "sections"}`
                        : "Surfer"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                      View
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No surfers in the database yet. After the surfers migration runs in Supabase, refresh this page or add a
              profile from the admin toolbar.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
