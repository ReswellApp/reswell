import { SupabaseClient } from "@supabase/supabase-js"
import { isUUID } from "@/lib/slugify"

function isListingRow(data: unknown): data is { section: string; id: string; slug?: string | null } {
  if (typeof data !== "object" || data === null) return false
  const row = data as Record<string, unknown>
  return typeof row.section === "string" && typeof row.id === "string"
}

function categorySlugFromListing(listing: {
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string | undefined {
  const c = listing.categories
  if (!c) return undefined
  const row = Array.isArray(c) ? c[0] : c
  return row?.slug?.trim() || undefined
}

/** Canonical detail URL for a listing (used by section-aware redirects). */
export function listingDetailPath(listing: {
  section: string
  slug?: string | null
  id: string
  categories?: { slug?: string | null } | Array<{ slug?: string | null }> | null
}): string {
  const ident = listing.slug || listing.id
  if (listing.section === "surfboards") return `/boards/${ident}`
  if (listing.section === "new") return `/shop/${listing.id}`
  if (listing.section === "used") {
    const cat = categorySlugFromListing(listing)
    if (cat) return `/${cat}/${ident}`
  }
  return `/${ident}`
}

/**
 * Look up a listing by its slug (preferred) or UUID (backward compat).
 * - redirectSlug: URL used a UUID and the row belongs on this route; redirect to slug within the same section.
 * - canonicalPath: listing exists but under a different section (e.g. opened a used URL for a surfboard); redirect here.
 */
export async function findListingByParam(
  supabase: SupabaseClient,
  param: string,
  {
    select,
    section: expectedSection,
  }: {
    select: string
    section?: string
  },
): Promise<{
  listing: any | null
  redirectSlug: string | null
  canonicalPath: string | null
}> {
  const byId = async (withSection: boolean) => {
    let q = supabase.from("listings").select(select).eq("id", param)
    if (withSection && expectedSection) q = q.eq("section", expectedSection)
    const { data } = await q.maybeSingle()
    return isListingRow(data) ? data : null
  }

  const bySlug = async (withSection: boolean) => {
    let q = supabase.from("listings").select(select).eq("slug", param)
    if (withSection && expectedSection) q = q.eq("section", expectedSection)
    const { data } = await q.maybeSingle()
    return isListingRow(data) ? data : null
  }

  if (isUUID(param)) {
    let data = expectedSection ? await byId(true) : await byId(false)
    if (!data && expectedSection) {
      data = await byId(false)
    }
    if (!data) {
      return { listing: null, redirectSlug: null, canonicalPath: null }
    }
    if (expectedSection && data.section !== expectedSection) {
      return {
        listing: data,
        redirectSlug: null,
        canonicalPath: listingDetailPath(data),
      }
    }
    const slug = (data as { slug?: string | null }).slug
    return {
      listing: data,
      redirectSlug: slug?.trim() ? slug : null,
      canonicalPath: null,
    }
  }

  let data = expectedSection ? await bySlug(true) : await bySlug(false)
  if (!data && expectedSection) {
    data = await bySlug(false)
  }
  if (!data) {
    return { listing: null, redirectSlug: null, canonicalPath: null }
  }
  if (expectedSection && data.section !== expectedSection) {
    return {
      listing: data,
      redirectSlug: null,
      canonicalPath: listingDetailPath(data),
    }
  }
  return { listing: data, redirectSlug: null, canonicalPath: null }
}
