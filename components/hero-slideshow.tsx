"use client"

import Image from "next/image"
import * as React from "react"
import { wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

/** Default hero art when there are no recent listing images to show. */
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

const SECONDS_PER_SLIDE = 14

/**
 * Full-viewport slides + one CSS keyframe animation. Avoids packed pixel widths and
 * per-image aspect updates — those were restarting the animation and resizing the track
 * during load (visible glitch on hard refresh).
 *
 * The track stays paused until the first slide has decoded so we never animate through
 * empty/black frames (the main cause of a "gross" hard refresh).
 */
type HeroSkeletonPhase = "show" | "fade" | "gone"

export function HeroSlideshow({ slides }: { slides: readonly string[] }) {
  const firstSlideDoneRef = React.useRef(false)
  const [skeletonPhase, setSkeletonPhase] = React.useState<HeroSkeletonPhase>("show")
  const [firstSlideReady, setFirstSlideReady] = React.useState(false)
  const [reduceMotion, setReduceMotion] = React.useState(false)

  React.useLayoutEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  if (slides.length === 0) return null

  const slideCount = slides.length
  const slidesLoop = [...slides, slides[0]]
  const totalDurationS = SECONDS_PER_SLIDE * slideCount
  const keyframeName = "hero-slideshow-x"

  const keyframes = `
    @keyframes ${keyframeName} {
      0% { transform: translateX(0); }
      100% { transform: translateX(-${slideCount * 100}vw); }
    }
  `

  const onFirstSlideResolved = () => {
    if (firstSlideDoneRef.current) return
    firstSlideDoneRef.current = true
    setFirstSlideReady(true)
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSkeletonPhase("gone")
    } else {
      setSkeletonPhase("fade")
    }
  }

  const baseTrackLayout: React.CSSProperties = {
    width: `${slidesLoop.length * 100}vw`,
    minWidth: `${slidesLoop.length * 100}vw`,
  }

  const trackMotion: React.CSSProperties = reduceMotion
    ? baseTrackLayout
    : {
        ...baseTrackLayout,
        animationName: keyframeName,
        animationDuration: `${totalDurationS}s`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
        animationFillMode: "none",
        animationPlayState: firstSlideReady ? "running" : "paused",
        willChange: firstSlideReady ? "transform" : "auto",
      }

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {skeletonPhase !== "gone" && (
        <div
          className={cn(
            "skeleton pointer-events-none absolute inset-0 z-[2] !rounded-none transition-opacity duration-500 ease-out motion-reduce:transition-none",
            skeletonPhase === "fade" && "opacity-0",
            skeletonPhase === "show" && "opacity-100",
          )}
          onTransitionEnd={(e) => {
            if (e.target !== e.currentTarget) return
            if (e.propertyName !== "opacity") return
            setSkeletonPhase((p) => (p === "fade" ? "gone" : p))
          }}
        />
      )}
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div className="relative z-[1] flex h-full flex-nowrap gap-0" style={trackMotion}>
        {slidesLoop.map((src, i) => {
          const isFirstFrame = i === 0
          const nextUpInCarousel = i === 1
          return (
            <div
              key={`${src}-${i}`}
              className="relative h-full shrink-0 overflow-hidden bg-zinc-100"
              style={{
                width: "100vw",
                minWidth: "100vw",
                maxWidth: "100vw",
              }}
            >
              <Image
                src={src}
                alt=""
                fill
                quality={isFirstFrame ? 80 : 72}
                sizes="100vw"
                className="object-cover object-center"
                placeholder="blur"
                blurDataURL={wideShimmer}
                loading={isFirstFrame || nextUpInCarousel ? "eager" : "lazy"}
                priority={isFirstFrame}
                fetchPriority={isFirstFrame ? "high" : nextUpInCarousel ? "high" : "low"}
                decoding={isFirstFrame ? "sync" : "async"}
                onLoad={() => {
                  if (isFirstFrame) onFirstSlideResolved()
                }}
                onError={() => {
                  if (isFirstFrame) onFirstSlideResolved()
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
