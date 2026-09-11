import { SupabaseClient } from "@supabase/supabase-js"
import { isUUID } from "@/lib/slugify"

function isListingRow(data: unknown): data is { section: string; id: string; slug?: string | null } {
  if (typeof data !== "object" || data === null) return false
  const row = data as Record<string, unknown>
  return typeof row.section === "string" && typeof row.id === "string"
}

/** Canonical detail URL for a listing (used by section-aware redirects). */
export function listingDetailPath(listing: {
  section: string
  slug?: string | null
  id: string
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string {
  const ident = listing.slug || listing.id
  return `/l/${ident}`
}

/**
 * Look up a listing by its slug (preferred) or UUID (backward compat).
 * - redirectSlug: URL used a UUID and the row belongs on this route; redirect to slug within the same section.
 * - canonicalPath: listing exists but the URL does not match the listing’s canonical path; redirect here.
 */
export async function findListingByParam(
  supabase: SupabaseClient,
  param: string,
  {
    select,
    section: expectedSection,
    /** When false (default), rows with hidden_from_site are excluded (public/catalog). */
    includeHiddenListings = false,
  }: {
    select: string
    section?: string
    includeHiddenListings?: boolean
  },
): Promise<{
  listing: any | null
  redirectSlug: string | null
  canonicalPath: string | null
  /** True when PostgREST rejected the select (not a genuine missing row). */
  queryFailed: boolean
}> {
  const applySiteVisibility = <T extends { eq: (c: string, v: boolean) => T }>(q: T) =>
    includeHiddenListings ? q : q.eq("hidden_from_site", false)

  const lookup = async (
    column: "id" | "slug",
    withSection: boolean,
  ): Promise<{ row: { section: string; id: string; slug?: string | null } | null; failed: boolean }> => {
    let q = applySiteVisibility(supabase.from("listings").select(select).eq(column, param))
    if (withSection && expectedSection) q = q.eq("section", expectedSection)
    const { data, error } = await q.maybeSingle()
    if (error) {
      console.error("[findListingByParam]", {
        param,
        column,
        expectedSection: expectedSection ?? null,
        code: error.code,
        message: error.message,
      })
      return { row: null, failed: true }
    }
    return { row: isListingRow(data) ? data : null, failed: false }
  }

  const byId = async (withSection: boolean) => lookup("id", withSection)
  const bySlug = async (withSection: boolean) => lookup("slug", withSection)

  if (isUUID(param)) {
    let found = expectedSection ? await byId(true) : await byId(false)
    if (!found.row && expectedSection) {
      found = await byId(false)
    }
    if (!found.row) {
      return {
        listing: null,
        redirectSlug: null,
        canonicalPath: null,
        queryFailed: found.failed,
      }
    }
    if (expectedSection && found.row.section !== expectedSection) {
      return {
        listing: found.row,
        redirectSlug: null,
        canonicalPath: listingDetailPath(found.row),
        queryFailed: false,
      }
    }
    const slug = found.row.slug
    return {
      listing: found.row,
      redirectSlug: slug?.trim() ? slug : null,
      canonicalPath: null,
      queryFailed: false,
    }
  }

  let found = expectedSection ? await bySlug(true) : await bySlug(false)
  if (!found.row && expectedSection) {
    found = await bySlug(false)
  }
  if (!found.row) {
    return {
      listing: null,
      redirectSlug: null,
      canonicalPath: null,
      queryFailed: found.failed,
    }
  }
  if (expectedSection && found.row.section !== expectedSection) {
    return {
      listing: found.row,
      redirectSlug: null,
      canonicalPath: listingDetailPath(found.row),
      queryFailed: false,
    }
  }
  return { listing: found.row, redirectSlug: null, canonicalPath: null, queryFailed: false }
}
