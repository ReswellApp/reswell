import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, ExternalLink, MapPin } from "lucide-react"
import type { BoardModel, BrandProfile } from "@/lib/index-directory/types"
import { extractDeckBottomPair } from "@/lib/index-directory/extract-deck-bottom"
import { getModelDetail } from "@/lib/index-directory/model-details-registry"
import { resolveModelGallery } from "@/lib/index-directory/resolve-model-gallery"
import { INDEX_DIRECTORY_BASE } from "@/lib/index-directory/routes"
import { Button } from "@/components/ui/button"
function rockerLine(m: BoardModel): string | null {
  const parts: string[] = []
  if (m.entryRocker) parts.push(`Entry: ${m.entryRocker}`)
  if (m.exitRocker) parts.push(`Exit: ${m.exitRocker}`)
  if (m.rockerStyle) parts.push(m.rockerStyle)
  return parts.length ? parts.join(" · ") : null
}

export async function BrandProfileView({ profile }: { profile: BrandProfile }) {
  const modelCount = profile.models.length

  const modelsVisual = profile.models.map((m) => {
    const detail = getModelDetail(profile.slug, m.slug)
    const gallery = resolveModelGallery(m, detail)
    const pair = extractDeckBottomPair(gallery, m, detail)
    return {
      model: m,
      cardImageUrl: pair?.deck ?? m.imageUrl,
      hasDeckBottom: Boolean(pair),
    }
  })

  return (
    <main className="flex-1">
      <div className="border-b border-border/80 bg-muted/15">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Link
            href={INDEX_DIRECTORY_BASE}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Index
          </Link>
        </div>
      </div>

      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto min-w-0 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Brand</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              {profile.name}
            </h1>
            <div className="relative mx-auto mt-5 h-14 w-40 overflow-hidden rounded-xl border border-border/80 bg-background px-3 py-2 shadow-soft sm:mt-6 sm:h-16 sm:w-44 sm:px-3.5 sm:py-2">
              <Image
                src={profile.logoUrl}
                alt={`${profile.name} logo`}
                fill
                className="object-contain object-center"
                sizes="(max-width: 640px) 160px, 176px"
                priority
              />
            </div>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:mt-6">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {profile.locationLabel}
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {profile.shortDescription}
            </p>
            <dl className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Founder</dt>
                <dd className="font-medium text-foreground">{profile.founderName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lead shaper / designer</dt>
                <dd className="font-medium text-foreground">{profile.leadShaperName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Models</dt>
                <dd className="font-medium tabular-nums text-foreground">{modelCount}</dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild className="rounded-full">
                <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Official site
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/search?q=${encodeURIComponent(profile.name)}`}>Search listings</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav
        className="sticky top-14 z-30 border-b border-border/80 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:top-16 md:top-20"
        aria-label="On this page"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 px-4 sm:px-6 sm:justify-start">
          <a
            href="#about"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            About
          </a>
          <a
            href="#models"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Models <span className="tabular-nums text-muted-foreground">({modelCount})</span>
          </a>
        </div>
      </nav>

      <section id="about" className="scroll-mt-28 border-b border-border/60 bg-background sm:scroll-mt-32 md:scroll-mt-36">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</h2>
          <div className="mt-6 space-y-5">
            {profile.aboutParagraphs.map((para, i) => (
              <p key={i} className="text-[17px] leading-[1.75] text-muted-foreground sm:text-lg sm:leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="models" className="scroll-mt-28 bg-muted/20 sm:scroll-mt-32 md:scroll-mt-36">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Board models</h2>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">Current line & classics</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              Rocker notes are summarized from public product data. Tap through for full specs and options on the brand
              site.
            </p>
          </div>

          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {modelsVisual.map(({ model: m, cardImageUrl, hasDeckBottom }) => (
              <li key={m.slug}>
                <Link
                  href={`${INDEX_DIRECTORY_BASE}/brands/${profile.slug}/models/${m.slug}`}
                  className="group block h-full rounded-xl border border-border/80 bg-card shadow-soft transition-all hover:border-foreground/20 hover:shadow-soft-hover"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-t-xl bg-muted">
                    {hasDeckBottom ? (
                      <span className="absolute right-2 top-2 z-10 rounded-md border border-border/80 bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm backdrop-blur-sm">
                        Deck / bottom
                      </span>
                    ) : null}
                    <Image
                      src={cardImageUrl}
                      alt={m.name}
                      fill
                      className="object-contain object-center p-3 transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug text-foreground group-hover:underline">{m.name}</h3>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </div>
                    {rockerLine(m) ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">{rockerLine(m)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                    <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      View details on Reswell
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-12 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Profile and model list compiled from publicly available information on the brand&apos;s site. Reswell is not
            affiliated with {profile.name}.
          </p>
        </div>
      </section>

      <div className="border-t border-border/80 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            <Link href={INDEX_DIRECTORY_BASE} className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to Index
            </Link>
            {" · "}
            <Link href="/used" className="font-medium text-foreground underline-offset-4 hover:underline">
              Browse used
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
