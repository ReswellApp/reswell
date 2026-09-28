"use client"

import type { AdsMediaRole } from "@/lib/types/adsManager"

export async function uploadAdsMedia(
  file: File,
  role: AdsMediaRole,
): Promise<{ resource: string; kind: "google_asset" | "meta_image" | "meta_video" }> {
  const body = new FormData()
  body.set("role", role)
  body.set("file", file)
  const response = await fetch("/api/admin/ads-manager/media", {
    method: "POST",
    body,
    credentials: "include",
  })
  const json = (await response.json().catch(() => null)) as {
    data?: { resource: string; kind: "google_asset" | "meta_image" | "meta_video" }
    error?: string
  } | null
  if (!response.ok || !json?.data?.resource) {
    throw new Error(json?.error || "Upload failed")
  }
  return json.data
}
