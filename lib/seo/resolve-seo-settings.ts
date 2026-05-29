import "server-only"
import { unstable_cache } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getSeoSettingsRow, mapSeoSettingsRow } from "@/lib/db/seo-settings"
import {
  DEFAULT_SEO_SETTINGS,
  SEO_SETTINGS_CACHE_TAG,
  type SeoSettingsValues,
} from "@/lib/seo/seo-settings-cache"

/**
 * Cached SEO settings (robots.txt overrides + extra sitemaps). Uses the service-role client so
 * robots.ts can read even for anonymous crawler requests. Falls back to defaults on any failure.
 */
export const getCachedSeoSettings = unstable_cache(
  async (): Promise<SeoSettingsValues> => {
    try {
      const supabase = createServiceRoleClient()
      const row = await getSeoSettingsRow(supabase)
      return mapSeoSettingsRow(row)
    } catch (error) {
      console.error("getCachedSeoSettings:", error instanceof Error ? error.message : error)
      return DEFAULT_SEO_SETTINGS
    }
  },
  ["seo-settings-global"],
  { tags: [SEO_SETTINGS_CACHE_TAG], revalidate: 300 },
)
