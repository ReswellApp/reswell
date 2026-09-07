import Image from "next/image"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { BoardBuyPhoto } from "@/lib/types/board-buy"

export function BoardBuyQuotePhotos({ photos }: { photos: BoardBuyPhoto[] }) {
  if (photos.length === 0) return null
  const [hero, ...rest] = photos

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted sm:aspect-[3/4]">
        <Image
          src={hero.url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover"
          unoptimized={listingImageShouldBypassOptimization(hero.url)}
        />
      </div>
      {rest.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {rest.map((photo) => (
            <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                unoptimized={listingImageShouldBypassOptimization(photo.url)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
