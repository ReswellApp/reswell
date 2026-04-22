"use client"

import Image from "next/image"
import * as React from "react"

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
export function HeroSlideshow({ slides }: { slides: readonly string[] }) {
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
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />
      <div
        className="flex h-full flex-nowrap gap-0"
        style={{
          width: `${slidesLoop.length * 100}vw`,
          minWidth: `${slidesLoop.length * 100}vw`,
          ...trackMotion,
        }}
      >
        {slidesLoop.map((src, i) => {
          const isRemote = src.startsWith("http://") || src.startsWith("https://")
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
