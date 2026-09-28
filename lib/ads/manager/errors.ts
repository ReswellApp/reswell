import type { AdsPlatform } from "@/lib/types/adsManager"

export class AdsManagerInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdsManagerInputError"
  }
}

export class AdsPlatformError extends Error {
  readonly platform: AdsPlatform

  constructor(message: string, platform: AdsPlatform) {
    super(message)
    this.name = "AdsPlatformError"
    this.platform = platform
  }
}

export function publicAdsError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Ads request failed"
  const cleaned = raw
    .replace(/ya29\.[A-Za-z0-9_\-]+/g, "[token]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[token]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280)
  return cleaned || "Ads request failed"
}
