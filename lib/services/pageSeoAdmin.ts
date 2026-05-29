import type { SupabaseClient } from "@supabase/supabase-js"
import { MANAGED_PAGES, getManagedPage } from "@/lib/seo/managed-pages"
import { isOverrideEmpty, type ManagedPageSeoItem } from "@/lib/seo/types"
import { mapOverrideRowToValues } from "@/lib/seo/resolve-page-seo"
import {
  deletePageSeoOverride,
  listPageSeoOverrides,
  upsertPageSeoOverride,
  type PageSeoOverrideRow,
  type PageSeoOverrideWriteColumns,
} from "@/lib/db/page-seo"
import type { PageSeoOverrideWriteInput } from "@/lib/validations/page-seo"

/**
 * Every managed page joined with its stored override. Pages without a row are returned on
 * pure defaults so the admin panel always shows the full, ordered registry.
 */
export async function listManagedPageSeoService(
  supabase: SupabaseClient,
): Promise<ManagedPageSeoItem[]> {
  const rows = await listPageSeoOverrides(supabase)
  const byKey = new Map<string, PageSeoOverrideRow>(rows.map((r) => [r.page_key, r]))

  return MANAGED_PAGES.map((page) => {
    const override = mapOverrideRowToValues(byKey.get(page.key) ?? null)
    return {
      key: page.key,
      group: page.group,
      label: page.label,
      note: page.note,
      variationOf: page.variationOf,
      defaults: page.defaults,
      override,
      customized: !isOverrideEmpty(override),
    }
  })
}

function inputToWriteColumns(input: PageSeoOverrideWriteInput): PageSeoOverrideWriteColumns {
  return {
    title: input.title ?? null,
    description: input.description ?? null,
    keywords: input.keywords ?? null,
    canonical_url: input.canonicalUrl ?? null,
    robots_index: input.robotsIndex ?? null,
    robots_follow: input.robotsFollow ?? null,
    og_title: input.ogTitle ?? null,
    og_description: input.ogDescription ?? null,
    og_image_url: input.ogImageUrl ?? null,
    og_type: input.ogType ?? null,
    twitter_card: input.twitterCard ?? null,
    twitter_title: input.twitterTitle ?? null,
    twitter_description: input.twitterDescription ?? null,
    twitter_image_url: input.twitterImageUrl ?? null,
    structured_data: input.structuredData ?? null,
  }
}

export async function savePageSeoOverrideService(
  supabase: SupabaseClient,
  input: PageSeoOverrideWriteInput,
  updatedBy: string | null,
): Promise<{ ok: true; cleared: boolean } | { ok: false; error: string }> {
  if (!getManagedPage(input.pageKey)) {
    return { ok: false, error: "Unknown page" }
  }
  const cols = inputToWriteColumns(input)
  return upsertPageSeoOverride(supabase, input.pageKey, cols, updatedBy)
}

export async function resetPageSeoOverrideService(
  supabase: SupabaseClient,
  pageKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getManagedPage(pageKey)) {
    return { ok: false, error: "Unknown page" }
  }
  return deletePageSeoOverride(supabase, pageKey)
}
