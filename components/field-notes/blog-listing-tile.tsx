import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import type { BlogEmbedListing } from "@/lib/types/blog-listing-embed"

export function BlogListingTile({ listing }: { listing: BlogEmbedListing }) {
  const sold = listing.status === "sold"

  return (
    <div className="mt-8 max-w-[220px]">
      <HomePeerListingScrollTile
        listing={listing}
        userId={null}
        isFavorited={false}
        layout="grid"
        imageSizesOverride="220px"
        statusLabel={sold ? "sold" : undefined}
      />
    </div>
  )
}
