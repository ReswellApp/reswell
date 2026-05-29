import type { SupabaseClient } from "@supabase/supabase-js"
import { MANAGED_PAGES, getManagedPage } from "@/lib/seo/managed-pages"
import { DYNAMIC_PAGE_TYPES, getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { EMPTY_OVERRIDE, isOverrideEmpty, type ManagedPageSeoItem, type PageSeoOverrideValues } from "@/lib/seo/types"
import { mapOverrideRowToValues } from "@/lib/seo/map-override-row"
import {
  deletePageSeoOverride,
  listPageSeoOverrides,
  upsertPageSeoOverride,
  type PageSeoOverrideRow,
  type PageSeoOverrideWriteColumns,
} from "@/lib/db/page-seo"
import { insertPageSeoHistory, listPageSeoHistory } from "@/lib/db/page-seo-history"
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

  const pageItems: ManagedPageSeoItem[] = MANAGED_PAGES.map((page) => {
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
      kind: "page" as const,
    }
  })

  // Dynamic page types (listings/brands/sellers) presented as template-based items.
  const dynamicItems: ManagedPageSeoItem[] = DYNAMIC_PAGE_TYPES.map((type) => {
    const override = mapOverrideRowToValues(byKey.get(type.key) ?? null)
    return {
      key: type.key,
      group: "dynamic" as const,
      label: type.label,
      note: type.note,
      defaults: {
        title: type.defaultTitleTemplate,
        description: type.defaultDescriptionTemplate,
        path: type.samplePath,
        openGraphType: "website" as const,
        robotsIndex: true,
        robotsFollow: true,
      },
      override,
      customized: !isOverrideEmpty(override),
      kind: "dynamic" as const,
      templateVars: type.variables.map((v) => ({ token: v.token, label: v.label, sample: v.sample })),
    }
  })

  return [...pageItems, ...dynamicItems]
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
  if (!getManagedPage(input.pageKey) && !getDynamicPageType(input.pageKey)) {
    return { ok: false, error: "Unknown page" }
  }
  const cols = inputToWriteColumns(input)
  const result = await upsertPageSeoOverride(supabase, input.pageKey, cols, updatedBy)
  if (result.ok) {
    const snapshot = inputToOverrideValues(input)
    await insertPageSeoHistory(
      supabase,
      input.pageKey,
      result.cleared ? "reset" : "save",
      result.cleared ? EMPTY_OVERRIDE : snapshot,
      updatedBy,
    )
  }
  return result
}

export async function resetPageSeoOverrideService(
  supabase: SupabaseClient,
  pageKey: string,
  changedBy: string | null = null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getManagedPage(pageKey) && !getDynamicPageType(pageKey)) {
    return { ok: false, error: "Unknown page" }
  }
  const result = await deletePageSeoOverride(supabase, pageKey)
  if (result.ok) {
    await insertPageSeoHistory(supabase, pageKey, "reset", EMPTY_OVERRIDE, changedBy)
  }
  return result
}

/** Recent change history (newest first) for a page or dynamic type. */
export async function listPageSeoHistoryService(supabase: SupabaseClient, pageKey: string) {
  return listPageSeoHistory(supabase, pageKey, 10)
}

function inputToOverrideValues(input: PageSeoOverrideWriteInput): PageSeoOverrideValues {
  return {
    title: input.title ?? null,
    description: input.description ?? null,
    keywords: input.keywords ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    robotsIndex: input.robotsIndex ?? null,
    robotsFollow: input.robotsFollow ?? null,
    ogTitle: input.ogTitle ?? null,
    ogDescription: input.ogDescription ?? null,
    ogImageUrl: input.ogImageUrl ?? null,
    ogType: input.ogType ?? null,
    twitterCard: input.twitterCard ?? null,
    twitterTitle: input.twitterTitle ?? null,
    twitterDescription: input.twitterDescription ?? null,
    twitterImageUrl: input.twitterImageUrl ?? null,
    structuredData: input.structuredData ?? null,
  }
}
