import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_SEO_SETTINGS, type SeoSettingsValues } from "@/lib/seo/seo-settings-cache"

export interface SeoSettingsRow {
  id: string
  discourage_all_crawlers: boolean
  extra_disallow: string[] | null
  extra_allow: string[] | null
  crawl_delay: number | null
  extra_sitemaps: string[] | null
  favicon_url: string | null
  apple_icon_url: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SeoSettingsWriteColumns = {
  discourage_all_crawlers: boolean
  extra_disallow: string[]
  extra_allow: string[]
  crawl_delay: number | null
  extra_sitemaps: string[]
  favicon_url: string | null
  apple_icon_url: string | null
}

export function mapSeoSettingsRow(row: SeoSettingsRow | null): SeoSettingsValues {
  if (!row) return DEFAULT_SEO_SETTINGS
  return {
    discourageAllCrawlers: row.discourage_all_crawlers,
    extraDisallow: row.extra_disallow ?? [],
    extraAllow: row.extra_allow ?? [],
    crawlDelay: row.crawl_delay,
    extraSitemaps: row.extra_sitemaps ?? [],
    faviconUrl: row.favicon_url,
    appleIconUrl: row.apple_icon_url,
  }
}

/** Network-level failures (undici "fetch failed", resets, timeouts) — transient, worth retrying. */
function isTransientNetworkError(message: string): boolean {
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
    message,
  )
}

const FETCH_RETRY_ATTEMPTS = 3
const FETCH_RETRY_BASE_DELAY_MS = 200

export async function getSeoSettingsRow(supabase: SupabaseClient): Promise<SeoSettingsRow | null> {
  let lastErrorMessage = ""

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("seo_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle()

    if (!error) {
      return (data as SeoSettingsRow | null) ?? null
    }

    lastErrorMessage = error.message
    if (!isTransientNetworkError(error.message)) {
      console.error("getSeoSettingsRow:", error.message)
      return null
    }
    if (attempt < FETCH_RETRY_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_BASE_DELAY_MS * attempt))
    }
  }

  // Transient network failure persisted through retries — callers fall back to
  // DEFAULT_SEO_SETTINGS, so this is degraded behavior, not an application error.
  console.warn(
    `getSeoSettingsRow: transient network failure after ${FETCH_RETRY_ATTEMPTS} attempts: ${lastErrorMessage}`,
  )
  return null
}

export async function upsertSeoSettings(
  supabase: SupabaseClient,
  cols: SeoSettingsWriteColumns,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("seo_settings")
    .upsert({ id: "global", updated_by: updatedBy, ...cols }, { onConflict: "id" })

  if (error) {
    console.error("upsertSeoSettings:", error.message)
    return { ok: false, error: error.message || "Could not save settings" }
  }
  return { ok: true }
}
