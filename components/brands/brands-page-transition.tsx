"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Soft crossfade when local brand/model pages change.
 * Locks min-height to the tallest page so a short last page doesn’t yank the pager up.
 * Keeps children mounted so list measurement refs stay valid.
 */
export function BrandsPageTransition({
  page,
  heightKey,
  className,
  children,
}: {
  page: number
  /** Reset locked height when layout density changes (e.g. pageSize / columns). */
  heightKey?: string | number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const firstPage = useRef(true)
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    setMinHeight(undefined)
  }, [heightKey])

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    if (firstPage.current) {
      firstPage.current = false
      return
    }

    node.classList.remove("animate-in", "fade-in", "duration-300", "fill-mode-backwards")
    // Force a reflow so the fade can restart without remounting children.
    void node.offsetWidth
    node.classList.add("animate-in", "fade-in", "duration-300", "fill-mode-backwards")
  }, [page])

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const height = node.getBoundingClientRect().height
    if (height <= 0) return
    setMinHeight((prev) => (prev == null ? height : Math.max(prev, height)))
  }, [page, heightKey, children])

  return (
    <div
      ref={ref}
      className={cn("motion-reduce:animate-none", className)}
      style={minHeight != null ? { minHeight } : undefined}
    >
      {children}
    </div>
  )
}
