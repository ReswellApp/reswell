import Link from "next/link"
import Image from "next/image"
import { Layers } from "lucide-react"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { proxiedBrandMediaSrc } from "@/lib/brand-media-proxy-url"
import { isConfiguredNextImageSrc } from "@/lib/brands/logo-mark"
import type { BrandPageModelCard } from "@/lib/brands/model-cards"
import { modelPageHref } from "@/lib/models/routes"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

function ModelTileImage({
  imageUrl,
  brandName,
  brandLogoUrl,
}: {
  imageUrl: string | null
  brandName: string
  brandLogoUrl: string | null
}) {
  const rawSrc = imageUrl ? proxiedBrandMediaSrc(imageUrl) : ""
  const src = rawSrc && isConfiguredNextImageSrc(rawSrc) ? rawSrc : null

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted/30">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized={listingImageShouldBypassOptimization(src)}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <BrandLogoMark
            name={brandName}
            logoUrl={brandLogoUrl}
            className="h-16 w-16 rounded-xl text-lg opacity-90"
            imageSizes="64px"
            decorative
          />
        </div>
      )}
    </div>
  )
}

export function BrandPageModelsGrid({
  brandSlug,
  brandName,
  brandLogoUrl,
  models,
  className,
}: {
  brandSlug: string
  brandName: string
  brandLogoUrl: string | null
  models: BrandPageModelCard[]
  className?: string
}) {
  if (models.length === 0) return null

  return (
    <section className={cn("mt-10 sm:mt-12", className)} aria-labelledby="brand-models-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="brand-models-heading" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Models
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {models.length === 1 ? "1 model" : `${models.length.toLocaleString("en-US")} models`} in the{" "}
            {brandName} catalog
          </p>
        </div>
        <Layers className="hidden h-5 w-5 text-muted-foreground/60 sm:block" aria-hidden />
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {models.map((model) => (
          <li key={model.id}>
            <Link
              href={modelPageHref(brandSlug, model.slug)}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-soft transition-colors hover:border-foreground/20 hover:shadow-soft-hover sm:rounded-2xl"
            >
              <ModelTileImage
                imageUrl={model.image_url}
                brandName={brandName}
                brandLogoUrl={brandLogoUrl}
              />
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:underline sm:text-base">
                  {model.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {brandProductCategoryLabel(model.product_category_slug)}
                </p>
                {model.description ? (
                  <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {model.description}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
