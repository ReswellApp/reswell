"use client"

import Image from "next/image"
import * as React from "react"
import ReactDOM from "react-dom"
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
 */
type HeroSkeletonPhase = "show" | "fade" | "gone"

export function HeroSlideshow({ slides }: { slides: readonly string[] }) {
  const [skeletonPhase, setSkeletonPhase] = React.useState<HeroSkeletonPhase>("show")

  if (slides.length === 0) return null

  // Preload every slide as soon as the page streams in so the carousel never
  // shows a partially-loaded image on refresh. First slide gets high priority
  // (it's visible immediately / LCP); the rest get low to avoid contending
  // with higher-value resources.
  for (let i = 0; i < slides.length; i++) {
    ReactDOM.preload(slides[i], {
      as: "image",
      fetchPriority: i === 0 ? "high" : "low",
    })
  }

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

  const revealAfterFirstSlideLoad = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSkeletonPhase("gone")
    } else {
      setSkeletonPhase("fade")
    }
  }

  const trackMotion: Pick<
    React.CSSProperties,
    | "animationName"
    | "animationDuration"
    | "animationTimingFunction"
    | "animationIterationCount"
    | "animationFillMode"
    | "willChange"
  > = {
    animationName: keyframeName,
    animationDuration: `${totalDurationS}s`,
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationFillMode: "none",
    willChange: "transform",
  }

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {skeletonPhase !== "gone" && (
        <div
          className={cn(
            "skeleton pointer-events-none absolute inset-0 z-0 !rounded-none transition-opacity duration-500 ease-out motion-reduce:transition-none",
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
      <div
        className="relative z-[1] flex h-full flex-nowrap gap-0"
        style={{
          width: `${slidesLoop.length * 100}vw`,
          minWidth: `${slidesLoop.length * 100}vw`,
          ...trackMotion,
        }}
      >
        {slidesLoop.map((src, i) => {
          const isRemote = src.startsWith("http://") || src.startsWith("https://")
          const isFirstFrame = i === 0
          return (
            <div
              key={`${src}-${i}`}
              className="relative h-full shrink-0 overflow-hidden bg-zinc-950"
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
                quality={100}
                sizes="100vw"
                className="object-cover object-center"
                loading="eager"
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "auto"}
                unoptimized={!isRemote}
                onLoadingComplete={() => {
                  if (isFirstFrame) revealAfterFirstSlideLoad()
                }}
                onError={() => {
                  if (isFirstFrame) revealAfterFirstSlideLoad()
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
