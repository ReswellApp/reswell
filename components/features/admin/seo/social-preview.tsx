"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"

interface SocialPreviewProps {
  title: string
  description: string
  imageUrl: string | null
  url: string
  siteOrigin: string
  /** 'summary' renders a compact square thumbnail; 'summary_large_image' a wide hero. */
  card: "summary" | "summary_large_image"
}

function domain(url: string, siteOrigin: string): string {
  try {
    if (/^https?:\/\//i.test(url)) return new URL(url).host
    return siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "")
  } catch {
    return siteOrigin
  }
}

export function SocialPreview({
  title,
  description,
  imageUrl,
  url,
  siteOrigin,
  card,
}: SocialPreviewProps) {
  const host = domain(url, siteOrigin)
  const large = card === "summary_large_image"

  const hero = imageUrl ? (
    <Image
      src={imageUrl}
      alt=""
      width={large ? 1200 : 240}
      height={large ? 630 : 240}
      className={large ? "h-40 w-full object-cover" : "h-24 w-24 shrink-0 object-cover"}
      unoptimized
    />
  ) : (
    <div
      className={
        large
          ? "flex h-40 w-full items-center justify-center bg-secondary"
          : "flex h-24 w-24 shrink-0 items-center justify-center bg-secondary"
      }
    >
      <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
    </div>
  )

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {large ? (
        <>
          {hero}
          <div className="space-y-0.5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{host}</p>
            <p className="line-clamp-1 text-sm font-semibold text-foreground">
              {title.trim() || "Untitled page"}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {description.trim() || "No description set."}
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-stretch">
          {hero}
          <div className="min-w-0 space-y-0.5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{host}</p>
            <p className="line-clamp-1 text-sm font-semibold text-foreground">
              {title.trim() || "Untitled page"}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {description.trim() || "No description set."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
