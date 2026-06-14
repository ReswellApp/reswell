import "server-only"
import { metadataShareImageUrl } from "@/lib/public-media-display-src"
import { getManagedPage } from "@/lib/seo/managed-pages"

export interface ManagedBrowseSeoSnapshot {
  title: string
  description: string
  shareImageUrl?: string
  robotsIndex: boolean
  robotsFollow: boolean
}

/** SEO snapshot from code defaults for a browse hub (no DB overrides). */
export function managedPageBrowseSeo(
  pageKey: string,
  fallback: { title: string; description: string },
): ManagedBrowseSeoSnapshot {
  const managed = getManagedPage(pageKey)
  if (!managed) {
    return { ...fallback, robotsIndex: true, robotsFollow: true }
  }

  const d = managed.defaults
  return {
    title: d.title,
    description: d.description,
    shareImageUrl: d.ogImageUrl ? metadataShareImageUrl(d.ogImageUrl) : undefined,
    robotsIndex: d.robotsIndex,
    robotsFollow: d.robotsFollow,
  }
}
