"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FadeInSectionProps {
  children: ReactNode
  className?: string
  /** Delay in ms before the animation starts (for staggered reveals). */
  delay?: number
  /** Intersection threshold before triggering (0–1). Default 0.08. */
  threshold?: number
}

function elementOverlapsViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  const vw = window.innerWidth
  return rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0
}

/**
 * Wraps children in a div that fades up into view once it enters the viewport.
 * Uses IntersectionObserver; respects `prefers-reduced-motion` via CSS.
 */
export function FadeInSection({
  children,
  className,
  delay = 0,
  threshold = 0.08,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    let visible = false
    const markVisible = () => {
      if (visible) return
      visible = true
      el.classList.remove("fade-in-pending")
      el.classList.add("is-visible")
    }

    // Avoid a post-hydration “blank band” for sections already in the viewport: run before paint
    // so the first paint matches the scroll-driven case as closely as possible.
    if (elementOverlapsViewport(el)) {
      markVisible()
      return
    }

    // Hide below-fold sections only after JS runs so no-JS crawlers still see the HTML.
    el.classList.add("fade-in-pending")

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markVisible()
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin: "0px 0px 12% 0px" },
    )

    observer.observe(el)

    // Soft-nav settle: `NavigationPageGate` may still be applying `page-enter` when this
    // first runs, which can stall IntersectionObserver under a transformed ancestor.
    // Recheck once that animation (260ms) has finished.
    const settleTimer = window.setTimeout(() => {
      if (visible) return
      if (elementOverlapsViewport(el)) {
        markVisible()
        observer.disconnect()
      }
    }, 300)

    return () => {
      observer.disconnect()
      window.clearTimeout(settleTimer)
    }
  }, [threshold])

  return (
    <div
      ref={ref}
      className={cn("fade-in-section", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
