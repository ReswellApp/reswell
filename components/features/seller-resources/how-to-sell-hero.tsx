import { HowToSellListingPhoto } from "@/components/features/seller-resources/how-to-sell-listing-photo"
import { SellerResourcesHero } from "@/components/features/seller-resources/seller-resources-hero"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"
import type { HowToSellPhotoExample } from "@/lib/types/seller-resources-how-to-sell"

export function HowToSellHero({ examples }: { examples: HowToSellPhotoExample[] }) {
  const mosaic = examples.slice(0, 3)

  return (
    <SellerResourcesHero
      title="Create your own surf shop"
      description="Reach buyers nationwide who are looking for boards. List in minutes — free to post, you only pay a fee when it sells."
      primaryCta={{ href: SURFBOARD_SELL_BOARDS_CREATE_HREF, label: "Start a listing" }}
      secondaryCta={{ href: "/sell", label: "Go to Sell" }}
      aside={
        mosaic.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2 aspect-[4/3] overflow-hidden rounded-3xl bg-muted sm:col-span-1 sm:row-span-2 sm:aspect-auto sm:min-h-[22rem]">
              <HowToSellListingPhoto
                src={mosaic[0]!.images[0]!}
                alt={mosaic[0]!.title}
                sizes="(max-width: 1024px) 100vw, 420px"
                priority
              />
            </div>
            {mosaic.slice(1).map((example) => (
              <div
                key={example.listingId}
                className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl bg-muted sm:block"
              >
                <HowToSellListingPhoto
                  src={example.images[0]!}
                  alt={example.title}
                  sizes="220px"
                />
              </div>
            ))}
          </div>
        ) : undefined
      }
    />
  )
}
