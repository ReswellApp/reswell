import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { formatUsd } from "@/lib/utils/format-usd"
import type { DashboardOverviewListingPreview } from "@/components/features/dashboard/dashboard-overview-model"

interface DashboardOverviewListingsProps {
  active: DashboardOverviewListingPreview[]
  drafts: DashboardOverviewListingPreview[]
}

export function DashboardOverviewListings({ active, drafts }: DashboardOverviewListingsProps) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <ListingSection
        title="Active listings"
        href="/dashboard/listings"
        listings={active}
        emptyTitle="No active listings"
        emptyBody={
          drafts.length > 0
            ? "Finish a draft below, or start a new one."
            : "Publish something and it will show up here."
        }
      />
      {drafts.length > 0 ? (
        <ListingSection
          title="Drafts"
          href="/dashboard/listings?status=draft"
          listings={drafts}
          badge="Draft"
        />
      ) : null}
    </div>
  )
}

interface ListingSectionProps {
  title: string
  href: string
  listings: DashboardOverviewListingPreview[]
  badge?: string
  emptyTitle?: string
  emptyBody?: string
}

function ListingSection({ title, href, listings, badge, emptyTitle, emptyBody }: ListingSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-headline text-[1.0625rem] font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {listings.length > 0 ? (
        <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {listings.map((listing) => (
            <ListingPreviewCard key={listing.id} listing={listing} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{emptyTitle}</p>
            {emptyBody ? <p className="mt-1 text-sm text-muted-foreground">{emptyBody}</p> : null}
          </div>
          <Button asChild>
            <Link href="/sell?new=1">Create a listing</Link>
          </Button>
        </div>
      )}
    </section>
  )
}

function ListingPreviewCard({
  listing,
  badge,
}: {
  listing: DashboardOverviewListingPreview
  badge?: string
}) {
  const title = capitalizeWords(listing.title)
  const imageSrc = listing.imageSrc

  return (
    <Link
      href={listing.href}
      className="group w-[9.5rem] shrink-0 snap-start sm:w-auto sm:shrink"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#f1f5f9]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={title}
            fill
            sizes="(min-width: 1280px) 220px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 160px"
            className="object-cover object-center transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
            unoptimized={listingImageShouldBypassOptimization(imageSrc)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f1f5f9] text-[#94a3b8]" aria-hidden>
            <Package className="h-7 w-7" />
          </div>
        )}
        {badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/92 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-foreground backdrop-blur-sm">
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2.5 line-clamp-2 min-h-10 text-sm font-medium leading-snug text-foreground">
        {title}
      </h3>
      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{formatUsd(listing.price)}</p>
    </Link>
  )
}
