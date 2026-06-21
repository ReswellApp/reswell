import Image from "next/image"
import { FALLBACK_HOME_HERO_SLIDE_PATHS } from "@/lib/home-hero-slide-urls"
import { portraitShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

const HERO_STACK_SIZE = 4

function buildHeroStackImages(
  listingImages: readonly string[],
  listingImagesOnly = false,
): string[] {
  const seen = new Set<string>()
  const stack: string[] = []

  for (const src of listingImages) {
    const trimmed = src.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    stack.push(trimmed)
    if (stack.length >= HERO_STACK_SIZE) return stack
  }

  if (listingImagesOnly) {
    return stack
  }

  for (const fallback of FALLBACK_HOME_HERO_SLIDE_PATHS) {
    if (stack.length >= HERO_STACK_SIZE) break
    if (seen.has(fallback)) continue
    seen.add(fallback)
    stack.push(fallback)
  }

  return stack
}

type AboutHeroBoardStackProps = {
  images: readonly string[]
  /** When true, never pad with static marketing hero-slide fallbacks. */
  listingImagesOnly?: boolean
  /** Smaller stacked boards on mobile for one-screen marketing layouts. */
  compactMobile?: boolean
}

export function AboutHeroBoardStack({
  images,
  listingImagesOnly = false,
  compactMobile = false,
}: AboutHeroBoardStackProps) {
  const stackImages = buildHeroStackImages(images, listingImagesOnly)

  if (stackImages.length === 0) {
    return null
  }

  return (
    <div
      data-lys-board-stack={compactMobile ? true : undefined}
      className={cn(
        "relative mx-auto flex w-full items-end justify-center lg:mx-0 lg:max-w-[34rem] lg:justify-end",
        compactMobile
          ? "max-lg:mx-auto max-lg:h-full lg:h-[300px] lg:max-w-2xl"
          : "h-[260px] max-w-xl sm:h-[300px] sm:max-w-2xl",
      )}
    >
      {stackImages.map((src, index) => (
        <div
          key={`${src}-${index}`}
          data-lys-board-card={compactMobile ? String(index) : undefined}
          className={cn(
            "absolute overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-lg shadow-black/10",
            index === 0 && "bottom-6 left-0 z-10 h-40 w-28 rotate-[-5deg] sm:h-44 sm:w-32",
            index === 1 &&
              "bottom-10 left-[24%] z-20 h-40 w-28 rotate-[3deg] sm:bottom-8 sm:left-[26%] sm:h-44 sm:w-32",
            index === 2 &&
              "bottom-8 left-[50%] z-30 h-40 w-28 rotate-[-2deg] sm:bottom-6 sm:left-[52%] sm:h-44 sm:w-32",
            index === 3 &&
              "bottom-4 right-0 z-40 h-44 w-32 rotate-[4deg] sm:bottom-2 sm:h-48 sm:w-36",
          )}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 40vw, 200px"
            placeholder="blur"
            blurDataURL={portraitShimmer}
          />
        </div>
      ))}
    </div>
  )
}
