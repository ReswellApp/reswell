import type { SupabaseClient } from "@supabase/supabase-js"
import { getSeoSettingsRow, mapSeoSettingsRow, upsertSeoSettings } from "@/lib/db/seo-settings"
import type { SeoSettingsValues } from "@/lib/seo/seo-settings-cache"
import type { SeoSettingsWriteInput } from "@/lib/validations/seo-settings"

export async function getSeoSettingsService(supabase: SupabaseClient): Promise<SeoSettingsValues> {
  const row = await getSeoSettingsRow(supabase)
  return mapSeoSettingsRow(row)
}

export async function saveSeoSettingsService(
  supabase: SupabaseClient,
  input: SeoSettingsWriteInput,
  updatedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return upsertSeoSettings(
    supabase,
    {
      discourage_all_crawlers: input.discourageAllCrawlers,
      extra_disallow: input.extraDisallow,
      extra_allow: input.extraAllow,
      crawl_delay: input.crawlDelay,
      extra_sitemaps: input.extraSitemaps,
      favicon_url: input.faviconUrl,
      apple_icon_url: input.appleIconUrl,
    },
    updatedBy,
  )
}
