import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight, ExternalLink } from "lucide-react"
import type { BoardModelDetail, BrandProfile, BoardModel, BoardModelGalleryImage } from "@/lib/index-directory/types"
import { Button } from "@/components/ui/button"
import { BoardModelDeckBottomHero } from "@/components/index-directory/board-model-deck-bottom-hero"
import { BoardModelStockDimsCollapsible } from "@/components/index-directory/board-model-stock-dims-collapsible"
import { cn } from "@/lib/utils"

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function resolveGallery(model: BoardModel, detail: BoardModelDetail | null): BoardModelGalleryImage[] {
  if (detail?.galleryImages?.length) {
    return detail.galleryImages
  }
  const out: BoardModelGalleryImage[] = [{ url: model.imageUrl, caption: "Board" }]
  if (detail?.marketingImageUrl) {
    out.push({ url: detail.marketingImageUrl, caption: "Model art" })
  }
  return out
}

function primaryHeroImage(gallery: BoardModelGalleryImage[], model: BoardModel): { url: string; caption: string } {
  return gallery[0] ?? { url: model.imageUrl, caption: "Board" }
}

function extractDeckBottom(gallery: BoardModelGalleryImage[]): { deck: string; bottom: string } | null {
  let deck: string | undefined
  let bottom: string | undefined

  for (const { url, caption } of gallery) {
    const c = caption.trim().toLowerCase()
    if (c === "deck") deck = url
    if (c === "bottom") bottom = url
  }

  if (!deck || !bottom) {
    for (const { url } of gallery) {
      const u = url.toLowerCase()
      if (!deck && /deck/i.test(u) && !/top-and-bottom|deck-and-bottom/i.test(u)) deck = url
      if (!bottom && /-bottom\./i.test(u) && !/top-and-bottom/i.test(u)) bottom = url
    }
  }

  if (deck && bottom && deck !== bottom) return { deck, bottom }
  return null
}

function galleryExcludingDeckBottom(
  gallery: BoardModelGalleryImage[],
  pair: { deck: string; bottom: string } | null,
): BoardModelGalleryImage[] {
  if (!pair) return gallery.slice(1)
  const skip = new Set([pair.deck, pair.bottom])
  return gallery.filter((g) => !skip.has(g.url))
}

function SpecLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{children}</h3>
  )
}

function RockerBlock({ model }: { model: BoardModel }) {
  const parts: string[] = []
  if (model.entryRocker) parts.push(`Entry ${model.entryRocker}`)
  if (model.exitRocker) parts.push(`Exit ${model.exitRocker}`)
  if (model.rockerStyle) parts.push(`Style ${model.rockerStyle}`)
  if (parts.length === 0) return null
  return (
    <div className="space-y-2 border-l-2 border-foreground/15 pl-3">
      <SpecLabel>Rocker</SpecLabel>
      <p className="text-sm leading-relaxed text-foreground">{parts.join(" · ")}</p>
    </div>
  )
}

function SpecPills({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((label) => (
        <li
          key={label}
          className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground"
        >
          {label}
        </li>
      ))}
    </ul>
  )
}

function OverviewColumn({ detail }: { detail: BoardModelDetail | null }) {
  return (
    <div className="min-w-0">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Overview</h2>
      <div className="mt-4 space-y-4">
        {detail && detail.descriptionParagraphs.length > 0 ? (
          detail.descriptionParagraphs.map((para, i) => (
            <p
              key={i}
              className={cn(
                "text-sm leading-[1.75] text-muted-foreground sm:text-[15px] sm:leading-[1.8]",
                i === 0 && "text-base font-medium leading-snug text-foreground/95 sm:text-lg",
              )}
            >
              {para}
            </p>
          ))
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Product description is not on file for this model yet. Visit the brand site for full details.
          </p>
        )}
      </div>
    </div>
  )
}

function SpecsSidebar({ model, detail }: { model: BoardModel; detail: BoardModelDetail | null }) {
  return (
    <div className="min-w-0">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Specifications
      </h2>
      <div className="mt-4 space-y-6">
        <RockerBlock model={model} />
        {detail && detail.waveSizeLabels.length > 0 ? (
          <div className="space-y-2 border-l-2 border-foreground/15 pl-3">
            <SpecLabel>Wave size</SpecLabel>
            <SpecPills items={detail.waveSizeLabels} />
          </div>
        ) : null}
        {detail && detail.skillLevelLabels.length > 0 ? (
          <div className="space-y-2 border-l-2 border-foreground/15 pl-3">
            <SpecLabel>Skill level</SpecLabel>
            <SpecPills items={detail.skillLevelLabels} />
          </div>
        ) : null}
        {detail && detail.stockDims.length > 0 ? (
          <BoardModelStockDimsCollapsible rows={detail.stockDims} />
        ) : null}
        {!detail ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Full dimensions are not on file for this model yet. Visit the brand site for complete specs.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function BoardModelPageView({
  brand,
  model,
  detail,
}: {
  brand: BrandProfile
  model: BoardModel
  detail: BoardModelDetail | null
}) {
  const brandModelsHref = `/index/brands/${brand.slug}`
  const priceLabel = detail?.priceUsd != null ? formatUsd(detail.priceUsd) : null
  const gallery = resolveGallery(model, detail)
  const deckBottom = extractDeckBottom(gallery)
  const heroFallback = primaryHeroImage(gallery, model)
  const galleryRest = galleryExcludingDeckBottom(gallery, deckBottom)

  return (
    <main className="flex-1 bg-background">
      <div className="border-b border-border/40 bg-muted/[0.35]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground sm:text-sm">
            <Link href="/index" className="rounded-md px-1 py-0.5 transition-colors hover:bg-background hover:text-foreground">
              Index
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            <Link
              href={brandModelsHref}
              className="rounded-md px-1 py-0.5 transition-colors hover:bg-background hover:text-foreground"
            >
              <span className="line-clamp-1">{brand.name}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            <span className="line-clamp-1 text-foreground">{model.name}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="border-b border-border/30 pb-8 pt-10 text-center sm:pt-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
            {brand.name}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl text-balance">
            {model.name}
          </h1>
          {priceLabel ? (
            <p className="mt-4 font-mono text-sm tabular-nums text-foreground/85 sm:text-base">
              <span className="font-sans text-muted-foreground">From </span>
              {priceLabel}
              <span className="font-sans text-muted-foreground"> MSRP</span>
            </p>
          ) : null}
        </header>

        {/* Centered hero + CTAs, then overview, then specifications */}
        <section className="border-b border-border/30 py-10 sm:py-12">
          <div className="mx-auto flex w-full max-w-md flex-col items-center">
            <div className="w-full">
              {deckBottom ? (
                <BoardModelDeckBottomHero
                  modelName={model.name}
                  deckUrl={deckBottom.deck}
                  bottomUrl={deckBottom.bottom}
                />
              ) : (
                <div className="rounded-2xl bg-gradient-to-b from-muted/50 to-background p-1 ring-1 ring-black/[0.04]">
                  <div className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[0.875rem] bg-background/90">
                    <Image
                      src={heroFallback.url}
                      alt={`${model.name} — ${heroFallback.caption}`}
                      fill
                      className="object-contain object-center p-6 sm:p-8"
                      sizes="(max-width: 1024px) 85vw, 24rem"
                      priority
                    />
                  </div>
                  <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {heroFallback.caption}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center">
              <Button asChild className="h-12 flex-1 rounded-xl text-sm font-semibold" size="lg">
                <a href={model.productUrl} target="_blank" rel="noopener noreferrer">
                  Shop on Channel Islands
                  <ExternalLink className="ml-2 h-4 w-4 opacity-80" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1 rounded-xl border-foreground/20 text-sm font-medium sm:h-12">
                <Link href={`/search?q=${encodeURIComponent(`${brand.name} ${model.name}`)}`}>Search on Reswell</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-10 w-full max-w-2xl border-t border-border/25 pt-10">
            <OverviewColumn detail={detail} />
          </div>

          <div className="mx-auto mt-10 w-full max-w-2xl border-t border-border/25 pt-10">
            <SpecsSidebar model={model} detail={detail} />
          </div>
        </section>

        {galleryRest.length > 0 ? (
          <section className="py-12 sm:py-16">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-border/30 pb-4">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">More angles</h2>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {galleryRest.length} {galleryRest.length === 1 ? "image" : "images"}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" role="list">
              {galleryRest.map((item, index) => (
                <li key={`${item.url}-${index}`}>
                  <figure
                    className={cn(
                      "group overflow-hidden rounded-2xl border border-border/40 bg-muted/20 transition-shadow duration-300",
                      "hover:border-border hover:shadow-soft-hover",
                    )}
                  >
                    <div className="relative aspect-[4/5] w-full">
                      <Image
                        src={item.url}
                        alt={`${model.name} — ${item.caption}`}
                        fill
                        className="object-contain object-center p-4 transition-transform duration-500 ease-out group-hover:scale-[1.02] sm:p-5"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    </div>
                    <figcaption className="border-t border-border/30 bg-card/80 px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {item.caption}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="border-t border-border/30 py-10">
          <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            Specs and pricing are compiled from public product pages and may change. Reswell is not affiliated with{" "}
            {brand.name}. Order through their site for the latest options.
          </p>
        </footer>
      </div>
    </main>
  )
}
