"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FadeInSectionProps {
  children: ReactNode
  className?: string
  /** Delay in ms before the animation starts (for staggered reveals). */
  delay?: number
  /** Intersection threshold before triggering (0–1). Default 0.08. */
  threshold?: number
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

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible")
          observer.unobserve(el)
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => observer.disconnect()
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
