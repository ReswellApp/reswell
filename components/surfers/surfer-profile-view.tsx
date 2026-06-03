import Image from "next/image"
import Link from "next/link"
import { ExternalLink, MapPin } from "lucide-react"
import { SURFERS_BASE, surferKeywordSearchHref } from "@/lib/surfers/routes"
import type { SurferRow } from "@/lib/surfers/types"
import { SurferDetailAdminBar } from "@/components/surfers/surfer-detail-admin-bar"
import { SurferQuiverGallery } from "@/components/surfers/surfer-quiver-gallery"
import { Button } from "@/components/ui/button"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { surferMediaDisplaySrc } from "@/lib/public-media-display-src"

export function SurferProfileView({ surfer }: { surfer: SurferRow }) {
  const paras = (surfer.about_paragraphs ?? []).map((p) => p.trim()).filter(Boolean)

  return (
    <main className="flex-1">
      <div className="border-b border-border/80 bg-muted/15">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={SURFERS_BASE}
              className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Surfers
            </Link>
            <SurferDetailAdminBar surfer={surfer} />
          </div>
        </div>
      </div>

      <header className="border-b border-border/80 bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Surfer</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              {surfer.name}
            </h1>

            {surfer.photo_url ? (
              <div className="relative mx-auto mt-6 h-28 w-28 overflow-hidden rounded-full border border-border/80 bg-background shadow-soft sm:h-32 sm:w-32">
                <Image
                  src={surferMediaDisplaySrc(surfer.photo_url)}
                  alt={`${surfer.name} photo`}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 320px, 384px"
                  quality={92}
                  priority
                  unoptimized={listingImageShouldBypassOptimization(
                    surferMediaDisplaySrc(surfer.photo_url),
                  )}
                />
              </div>
            ) : null}

            {surfer.location_label ? (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {surfer.location_label}
              </p>
            ) : null}

            {surfer.short_description ? (
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                {surfer.short_description}
              </p>
            ) : null}

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {surfer.instagram_url ? (
                <Button asChild className="rounded-full px-6">
                  <a href={surfer.instagram_url} target="_blank" rel="noopener noreferrer">
                    Instagram
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {surfer.youtube_url ? (
                <Button asChild variant={surfer.instagram_url ? "outline" : "default"} className="rounded-full px-6">
                  <a href={surfer.youtube_url} target="_blank" rel="noopener noreferrer">
                    YouTube
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
              <Button
                asChild
                variant={surfer.instagram_url || surfer.youtube_url ? "outline" : "default"}
                className="rounded-full px-6"
              >
                <Link href={surferKeywordSearchHref(surfer.name)}>Search listings</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {paras.length > 0 ? (
        <section className="border-b border-border/80 bg-background" aria-label="Bio">
          <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="mx-auto max-w-2xl space-y-6">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">About</h2>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                {paras.map((p, i) => (
                  <p key={i} className="text-pretty">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <SurferQuiverGallery displayName={surfer.name} items={surfer.quiver_items} />

      <footer className="border-t border-border/80 py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            <Link href={SURFERS_BASE} className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to Surfers
            </Link>
            {" · "}
            <Link href="/brands" className="font-medium text-foreground underline-offset-4 hover:underline">
              Brands
            </Link>
            {" · "}
            <Link href="/gear" className="font-medium text-foreground underline-offset-4 hover:underline">
              Browse used
            </Link>
          </p>
        </div>
      </footer>
    </main>
  )
}
