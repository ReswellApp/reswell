import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import type { BlogEmbedListing } from "@/lib/types/blog-listing-embed"

export function BlogSoldListings({ listings }: { listings: BlogEmbedListing[] }) {
  if (listings.length === 0) return null

  return (
    <div className="mt-10">
      <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#355185]">Recently sold</p>
      <div className="grid grid-cols-2 gap-3">
        {listings.map((listing) => (
          <HomePeerListingScrollTile
            key={listing.id}
            listing={listing}
            userId={null}
            isFavorited={false}
            layout="grid"
            imageSizesOverride="(max-width: 768px) 50vw, 336px"
            statusLabel="sold"
          />
        ))}
      </div>
    </div>
  )
}
