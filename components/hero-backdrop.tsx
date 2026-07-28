import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import heroBackdrop from "@/public/images/home/hero-backdrop-mesa-v2.jpg"

/** Full-bleed static hero background — backdrop only; copy and CTAs live in the page shell. */
export function HeroBackdrop() {
  return (
    <div
      className="absolute inset-x-0 top-0 overflow-hidden max-lg:h-[42svh] sm:max-lg:h-[46svh] md:max-lg:h-[50svh] lg:inset-0 lg:h-full"
      aria-hidden
    >
      <Image
        src={heroBackdrop}
        alt=""
        fill
        priority
        fetchPriority="high"
        quality={95}
        sizes="100vw"
        className="object-cover object-[center_45%] max-lg:object-[60%_50%] lg:object-[center_40%]"
        placeholder="blur"
        blurDataURL={wideShimmer}
      />
    </div>
  )
}
