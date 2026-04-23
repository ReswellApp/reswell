"use client"

import Image from "next/image"
import { useLayoutEffect, useState } from "react"
import { cn } from "@/lib/utils"

const overlayEase =
  "transition-opacity duration-500 transition-timing-function-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"
const logoEase =
  "transition-[transform,opacity] duration-300 transition-timing-function-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"

function ReswellMarkImage({ className, visible }: { className?: string; visible: boolean }) {
  return (
    <Image
      src="/images/reswell-mark.png"
      alt=""
      width={256}
      height={256}
      className={cn(
        "h-auto w-[clamp(72px,15vw,112px)]",
        logoEase,
        visible ? "scale-100 opacity-100" : "scale-[0.96] opacity-0",
        className
      )}
      priority
    />
  )
}

type RouteTransitionMarkProps = {
  /**
   * `overlay` — fills the flex main column only (for App Router `loading.tsx` under SiteChrome:
   * renders below the sticky header and category bar; does not cover them).
   * `inline` — same layout wrapped in `<main>` when the loader includes its own Header/Footer shell.
   */
  variant?: "overlay" | "inline"
}

export function RouteTransitionMark({ variant = "overlay" }: RouteTransitionMarkProps) {
  const [enter, setEnter] = useState(false)

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnter(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const mark = <ReswellMarkImage visible={enter} />

  const overlayClassName = cn(
    "flex w-full flex-1 flex-col items-center justify-center self-stretch",
    /* Fill the SiteChrome main column: keep footer under the fold while RSC loads (min-h-0 on flex-1
       alone can collapse the strip to the logo, so the footer “jumps up” mid-viewport on refresh). */
    "h-full min-h-[calc(100dvh-12rem)] sm:min-h-[calc(100dvh-10rem)]",
    "bg-gradient-to-b from-background via-background to-muted/30",
    "px-6 py-20",
    overlayEase,
    enter ? "opacity-100" : "opacity-0",
  )

  const inlineClassName = cn(
    "flex w-full min-h-0 flex-1 flex-col items-center justify-center self-stretch",
    "bg-gradient-to-b from-background via-background to-muted/30",
    "px-6 py-20",
    overlayEase,
    enter ? "opacity-100" : "opacity-0",
  )

  if (variant === "inline") {
    return (
      <main className={inlineClassName} aria-hidden>
        {mark}
      </main>
    )
  }

  return (
    <div
      className={overlayClassName}
      role="status"
      aria-label="Loading page"
    >
      {mark}
    </div>
  )
}
