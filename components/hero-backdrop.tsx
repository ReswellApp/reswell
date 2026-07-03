import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { HOME_HERO_BACKDROP_PATH } from "@/lib/home-hero-slide-urls"

/** Full-bleed static hero background — backdrop only; copy and CTAs live in the page shell. */
export function HeroBackdrop({ src = HOME_HERO_BACKDROP_PATH }: { src?: string }) {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden max-lg:h-[42svh] sm:max-lg:h-[46svh] md:max-lg:h-[50svh] lg:inset-0 lg:h-full"
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        fetchPriority="high"
        quality={92}
        unoptimized
        sizes="100vw"
        className="object-cover object-[center_30%] max-lg:object-[center_20%] lg:object-center"
        placeholder="blur"
        blurDataURL={wideShimmer}
      />
    </div>
  )
}
