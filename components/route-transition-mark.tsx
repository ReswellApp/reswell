"use client"

import { useLayoutEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const overlayEase =
  "transition-opacity duration-500 transition-timing-function-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"
const indicatorEase =
  "transition-[transform,opacity] duration-300 transition-timing-function-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0"

function LoadingIndicator({ visible }: { visible: boolean }) {
  return (
    <Skeleton
      className={cn(
        "h-2.5 w-24 rounded-full bg-muted/70",
        indicatorEase,
        visible ? "scale-100 opacity-100" : "scale-[0.96] opacity-0",
      )}
      aria-hidden
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

  const indicator = <LoadingIndicator visible={enter} />

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
        {indicator}
      </main>
    )
  }

  return (
    <div
      className={overlayClassName}
      role="status"
      aria-label="Loading page"
    >
      {indicator}
    </div>
  )
}
