import Image from "next/image"
import { squareShimmer, wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"
import type { CareerRolePhoto } from "@/lib/careers"

type CareerRolePhotoGridProps = {
  photos: readonly CareerRolePhoto[]
  className?: string
}

export function CareerRolePhotoGrid({ photos, className }: CareerRolePhotoGridProps) {
  return (
    <ul className={cn("grid gap-8 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12", className)}>
      {photos.map((photo) => (
        <li key={photo.src} className={cn(photo.wide && "sm:col-span-2")}>
          <figure>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl bg-muted",
                photo.wide ? "aspect-[4/3]" : "aspect-[4/5]",
              )}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={
                  photo.wide
                    ? "(max-width: 1024px) 100vw, 640px"
                    : "(max-width: 640px) 100vw, 320px"
                }
                quality={90}
                className="object-cover"
                placeholder="blur"
                blurDataURL={photo.wide ? wideShimmer : squareShimmer}
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">{photo.caption}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}
