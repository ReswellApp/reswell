"use client"

import { useEffect, useMemo, useState } from "react"
import { Globe } from "lucide-react"
import { seoMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"
import {
  PIXEL_LIMITS,
  approximateTextPx,
  descriptionPx,
  titlePx,
} from "./measure-text"

interface SerpPreviewProps {
  title: string
  description: string
  /** Canonical path or absolute URL. */
  url: string
  siteOrigin: string
  /** Site favicon shown in the result row (falls back to a globe when unset). */
  faviconUrl?: string | null
}

/** Truncate text so its rendered width fits `maxPx`, then add an ellipsis. */
function truncateByPx(text: string, maxPx: number, measure: (t: string) => number): string {
  const t = text.trim()
  if (measure(t) <= maxPx) return t
  let lo = 0
  let hi = t.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(`${t.slice(0, mid)}…`) <= maxPx) lo = mid
    else hi = mid - 1
  }
  return `${t.slice(0, lo).trimEnd()}…`
}

/** Renders a path/absolute URL as a Google-style breadcrumb (origin › segment › segment). */
function breadcrumb(url: string, siteOrigin: string): string {
  let path = url
  let host = siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "")
  try {
    if (/^https?:\/\//i.test(url)) {
      const parsed = new URL(url)
      host = parsed.host
      path = parsed.pathname + parsed.search
    }
  } catch {
    /* keep raw */
  }
  const segments = path.split("?")[0].split("/").filter(Boolean)
  return [host, ...segments].join(" › ")
}

export function SerpPreview({ title, description, url, siteOrigin, faviconUrl }: SerpPreviewProps) {
  const displayTitle = title.trim() || "Untitled page"
  const displayDesc = description.trim() || "No meta description set."

  // Canvas measureText differs from SSR approximation — defer until after hydration.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const { titleMeasure, descMeasure } = useMemo(() => {
    if (hydrated) {
      return { titleMeasure: titlePx, descMeasure: descriptionPx }
    }
    return {
      titleMeasure: (t: string) => approximateTextPx(t, 20),
      descMeasure: (t: string) => approximateTextPx(t, 14),
    }
  }, [hydrated])

  const titleWidth = titleMeasure(displayTitle)
  const descWidth = descMeasure(displayDesc)
  const titleOver = titleWidth > PIXEL_LIMITS.title
  const descOver = descWidth > PIXEL_LIMITS.description

  return (
    <div className="rounded-lg border border-border bg-white p-4 font-sans dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
          {faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/SVG favicon URL
            <img src={seoMediaDisplaySrc(faviconUrl)} alt="" className="h-3.5 w-3.5 object-contain" />
          ) : (
            <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] text-foreground">Reswell</p>
          <p className="truncate text-xs text-muted-foreground">{breadcrumb(url, siteOrigin)}</p>
        </div>
      </div>
      <p className="mt-1 truncate text-[18px] leading-6 text-[#1a0dab] dark:text-[#8ab4f8]">
        {truncateByPx(displayTitle, PIXEL_LIMITS.title, titleMeasure)}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[#4d5156] dark:text-zinc-400">
        {truncateByPx(displayDesc, PIXEL_LIMITS.description, descMeasure)}
      </p>
      <div className="mt-2 flex items-center gap-3 border-t border-border pt-1.5 text-[10px] tabular-nums text-muted-foreground">
        <span className={cn(titleOver && "font-medium text-destructive")}>
          Title {titleWidth}px / {PIXEL_LIMITS.title}px{titleOver ? " · truncated" : ""}
        </span>
        <span className={cn(descOver && "font-medium text-destructive")}>
          Desc {descWidth}px / {PIXEL_LIMITS.description}px{descOver ? " · truncated" : ""}
        </span>
      </div>
    </div>
  )
}
