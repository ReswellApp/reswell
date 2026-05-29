"use client"

import { Globe } from "lucide-react"

interface SerpPreviewProps {
  title: string
  description: string
  /** Canonical path or absolute URL. */
  url: string
  siteOrigin: string
}

const TITLE_MAX = 60
const DESC_MAX = 160

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
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

export function SerpPreview({ title, description, url, siteOrigin }: SerpPreviewProps) {
  const displayTitle = title.trim() || "Untitled page"
  const displayDesc = description.trim() || "No meta description set."

  return (
    <div className="rounded-lg border border-border bg-white p-4 font-sans dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] text-foreground">Reswell</p>
          <p className="truncate text-xs text-muted-foreground">{breadcrumb(url, siteOrigin)}</p>
        </div>
      </div>
      <p className="mt-1 truncate text-[18px] leading-6 text-[#1a0dab] dark:text-[#8ab4f8]">
        {truncate(displayTitle, TITLE_MAX)}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[#4d5156] dark:text-zinc-400">
        {truncate(displayDesc, DESC_MAX)}
      </p>
    </div>
  )
}
