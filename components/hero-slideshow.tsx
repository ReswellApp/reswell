import Image from "next/image"

/** Default hero art before rows in `public.images` with scope `home_hero`. */
export const FALLBACK_HOME_HERO_SLIDE_PATHS = [
  "/images/home/hero-slide-1.png",
  "/images/home/hero-slide-2.png",
  "/images/home/hero-slide-3.png",
  "/images/home/hero-slide-4.png",
  "/images/home/hero-slide-5.png",
  "/images/home/hero-slide-6.png",
  "/images/home/hero-slide-7.png",
  "/images/home/hero-slide-8.png",
] as const

/** Request up to 4K so hero displays at highest quality on large/retina screens */
const IMG_WIDTH = 3840
const IMG_HEIGHT = 2160
const SECONDS_PER_SLIDE = 14

export function HeroSlideshow({ slides }: { slides: readonly string[] }) {
  if (slides.length === 0) return null

  /** Duplicate first slide for seamless loop (no visible jump when animation restarts) */
  const slidesLoop = [...slides, slides[0]]
  const slideCount = slides.length
  const totalDurationS = SECONDS_PER_SLIDE * slideCount

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hero-slide-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-${slideCount * 100}vw); }
        }
      `}} />
      <div
        className="flex h-full"
        style={{
          width: `${slidesLoop.length * 100}vw`,
          minWidth: `${slidesLoop.length * 100}vw`,
          animation: `hero-slide-x ${totalDurationS}s linear infinite`,
          willChange: "transform",
        }}
      >
        {slidesLoop.map((src, i) => {
          const isRemote = src.startsWith("http://") || src.startsWith("https://")
          return (
            <div
              key={`${src}-${i}`}
              className="relative h-full flex-shrink-0 overflow-hidden bg-black"
              style={{
                width: "100vw",
                minWidth: "100vw",
              }}
            >
              <Image
                src={src}
                alt=""
                width={IMG_WIDTH}
                height={IMG_HEIGHT}
                quality={100}
                sizes="100vw"
                className="h-full w-full object-cover object-center"
                loading={i === 0 ? "eager" : "lazy"}
                priority={i === 0}
                unoptimized={!isRemote}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
