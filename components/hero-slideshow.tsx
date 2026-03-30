import Image from "next/image"

const SLIDES = [
  "/images/home/hero-slide-1.png",
  "/images/home/hero-slide-2.png",
  "/images/home/hero-slide-3.png",
  "/images/home/hero-slide-4.png",
  "/images/home/hero-slide-5.png",
  "/images/home/hero-slide-6.png",
  "/images/home/hero-slide-7.png",
  "/images/home/hero-slide-8.png",
]

/** Duplicate first slide for seamless loop (no visible jump when animation restarts) */
const SLIDES_LOOP = [...SLIDES, SLIDES[0]]

const SLIDE_COUNT = SLIDES.length
const SECONDS_PER_SLIDE = 14
const TOTAL_DURATION_S = SECONDS_PER_SLIDE * SLIDE_COUNT

/** Request up to 4K so hero displays at highest quality on large/retina screens */
const IMG_WIDTH = 3840
const IMG_HEIGHT = 2160

export function HeroSlideshow() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hero-slide-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-${SLIDE_COUNT * 100}vw); }
        }
      `}} />
      <div
        className="flex h-full"
        style={{
          width: `${SLIDES_LOOP.length * 100}vw`,
          minWidth: `${SLIDES_LOOP.length * 100}vw`,
          animation: `hero-slide-x ${TOTAL_DURATION_S}s linear infinite`,
          willChange: "transform",
        }}
      >
        {SLIDES_LOOP.map((src, i) => (
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
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  )
}
