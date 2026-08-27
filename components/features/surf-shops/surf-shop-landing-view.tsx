import Image from "next/image"
import Link from "next/link"
import { ExternalLink, MapPin, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SURF_SHOPS_BASE,
  surfShopLocationLabel,
  surfShopNearbyBoardsHref,
  surfShopTelHref,
  type CitySurfShop,
} from "@/lib/city-landing-surf-shops"

export function SurfShopLandingView({ shop }: { shop: CitySurfShop }) {
  const location = surfShopLocationLabel(shop)
  const nearbyHref = surfShopNearbyBoardsHref(shop)
  const nearbyLabel = shop.nearbyCityName
    ? `Browse used boards in ${shop.nearbyCityName}`
    : "Browse used boards nearby"

  return (
    <main className="flex-1">
      <header className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <Link
            href={SURF_SHOPS_BASE}
            className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Surf shops
          </Link>

          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-white p-2 sm:h-36 sm:w-36">
              <Image
                src={shop.logoSrc}
                alt={`${shop.name} logo`}
                fill
                priority
                sizes="144px"
                className="object-contain p-2"
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {shop.name}
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{location}</span>
                {shop.foundedYear ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Est. {shop.foundedYear}</span>
                  </>
                ) : null}
              </p>
              {shop.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  {shop.description}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {shop.mapsUrl ? (
                  <Button asChild size="sm">
                    <a href={shop.mapsUrl} target="_blank" rel="noopener noreferrer">
                      Get directions
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {nearbyHref ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={nearbyHref}>{nearbyLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {shop.address || shop.phone || shop.websiteUrl ? (
        <section className="bg-background" aria-labelledby="surf-shop-visit-heading">
          <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <h2
              id="surf-shop-visit-heading"
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              Visit the shop
            </h2>
            <dl className="mt-5 max-w-xl space-y-4 text-sm">
              {shop.address ? (
                <div>
                  <dt className="font-medium text-foreground">Address</dt>
                  <dd className="mt-1 text-muted-foreground">
                    {shop.mapsUrl ? (
                      <a
                        href={shop.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {shop.address}
                      </a>
                    ) : (
                      shop.address
                    )}
                  </dd>
                </div>
              ) : null}
              {shop.phone ? (
                <div>
                  <dt className="font-medium text-foreground">Phone</dt>
                  <dd className="mt-1">
                    <a
                      href={surfShopTelHref(shop.phone)}
                      className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {shop.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {shop.websiteUrl ? (
                <div>
                  <dt className="font-medium text-foreground">Website</dt>
                  <dd className="mt-1">
                    <a
                      href={shop.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {shop.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}
    </main>
  )
}
