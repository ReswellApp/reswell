import { Truck } from "lucide-react"
import { ListingCatalogIdentity } from "@/components/features/listings/listing-catalog-identity"
import { ListingSurfboardBreadcrumbs } from "@/components/features/listings/listing-surfboard-breadcrumbs"
import { ListingSoldDetailNotice } from "@/components/listing-sold-detail-notice"
import {
  loadSurfboardListingIdentity,
  loadSurfboardSoldShipped,
} from "@/lib/services/surfboardListingPdpExtras"
import { cn } from "@/lib/utils"

type SurfboardIdentityVariant = "breadcrumbs" | "catalog"

type SurfboardIdentityViewProps = {
  variant: SurfboardIdentityVariant
  freeBrandLabel: string
  modelName: string
  listingTitle: string
  className?: string
}

function brandLabel(freeBrandLabel: string, canonicalName: string | null): string | null {
  return (canonicalName ?? freeBrandLabel).trim() || null
}

function SurfboardIdentityView({
  variant,
  freeBrandLabel,
  modelName,
  listingTitle,
  className,
  brandName,
  brandHref,
  modelHref,
}: SurfboardIdentityViewProps & {
  brandName: string | null
  brandHref: string | null
  modelHref: string | null
}) {
  const model = modelName.trim() || null
  if (variant === "breadcrumbs") {
    return (
      <ListingSurfboardBreadcrumbs
        brandName={brandName}
        brandHref={brandHref}
        modelName={model}
        modelHref={modelHref}
        listingTitle={listingTitle}
      />
    )
  }

  return (
    <ListingCatalogIdentity
      brandName={brandName}
      brandHref={brandHref}
      modelName={model}
      modelHref={modelHref}
      className={className}
    />
  )
}

/** First paint: brand and model text already stored on the listing row. */
export function SurfboardListingIdentityFallback(props: SurfboardIdentityViewProps) {
  return (
    <SurfboardIdentityView
      {...props}
      brandName={brandLabel(props.freeBrandLabel, null)}
      brandHref={null}
      modelHref={null}
    />
  )
}

/** Canonical brand link and model page, streamed after the gallery. */
export async function SurfboardListingIdentity({
  brandId,
  brandModelId,
  ...props
}: SurfboardIdentityViewProps & {
  brandId: string
  brandModelId: string
}) {
  const identity = await loadSurfboardListingIdentity(brandId, brandModelId, props.modelName)
  return (
    <SurfboardIdentityView
      {...props}
      brandName={brandLabel(props.freeBrandLabel, identity.brandName)}
      brandHref={identity.brandHref}
      modelHref={identity.modelPagePath}
    />
  )
}

export async function SurfboardListingSoldNotice({ listingId }: { listingId: string }) {
  const shipped = await loadSurfboardSoldShipped(listingId)
  return <ListingSoldDetailNotice shipped={shipped} />
}

export async function SurfboardListingShippedDetail({ listingId }: { listingId: string }) {
  const shipped = await loadSurfboardSoldShipped(listingId)
  if (!shipped) return null
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
      <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      This board was shipped
    </p>
  )
}

export async function SurfboardListingSoldStatusNote({ listingId }: { listingId: string }) {
  const shipped = await loadSurfboardSoldShipped(listingId)
  if (!shipped) return null
  return (
    <li className="flex gap-2.5 text-[14px] leading-snug">
      <Truck className={cn("mt-0.5 h-4 w-4 shrink-0 text-listingHeart")} aria-hidden />
      <p>
        <span className="font-semibold text-foreground">This item was shipped</span>
      </p>
    </li>
  )
}
