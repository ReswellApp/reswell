import type { SupabaseClient } from "@supabase/supabase-js"
import { listBrandCatalogImageSourcesForAdmin } from "@/lib/db/brand-catalog-images"
import {
  listLiveListingImagesForBrandModelAdmin,
  listSoldListingImagesForBrandModelAdmin,
} from "@/lib/db/brand-model-listing-images"
import { catalogImageDedupeKey } from "@/lib/utils/catalog-image-url"
import { formatBrandModelVariantLabel } from "@/lib/utils/brand-model-dimensions"
import type { brandCatalogImagePickerSourceSchema } from "@/lib/validations/brand-catalog-images"
import type { z } from "zod"

export type BrandCatalogImagePickerSource = z.infer<typeof brandCatalogImagePickerSourceSchema>

export type BrandCatalogImagePickerItem = {
  image_url: string
  /** Smaller URL for grid display when available (listing thumbnails). */
  thumbnail_url?: string | null
  /** One line per source (hero / variant / listing) that uses this URL. */
  source_lines: string[]
  is_focus_model: boolean
  /** Lexical sort key: model name of first source. */
  sort_model_name: string
}

function listingSourceLine(title: string, dimensions: string | null, kind: "live" | "sold"): string {
  const dim = dimensions?.trim()
  const suffix = kind === "live" ? "Live listing" : "Sold listing"
  return dim ? `${title} · ${dim} · ${suffix}` : `${title} · ${suffix}`
}

function bucketListingImages(
  sources: Awaited<ReturnType<typeof listLiveListingImagesForBrandModelAdmin>>,
  kind: "live" | "sold",
): BrandCatalogImagePickerItem[] {
  const buckets = new Map<
    string,
    {
      image_url: string
      thumbnail_url: string | null
      lines: string[]
      sort_name: string
    }
  >()

  for (const s of sources) {
    const key = catalogImageDedupeKey(s.image_url)
    if (!key) continue

    const line = listingSourceLine(s.listing_title, s.dimensions, kind)
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, {
        image_url: s.image_url.trim(),
        thumbnail_url: s.thumbnail_url,
        lines: [line],
        sort_name: s.listing_title,
      })
    } else {
      if (!existing.lines.includes(line)) existing.lines.push(line)
      if (!existing.thumbnail_url && s.thumbnail_url) {
        existing.thumbnail_url = s.thumbnail_url
      }
      if (s.listing_title.localeCompare(existing.sort_name) < 0) {
        existing.sort_name = s.listing_title
      }
    }
  }

  const items: BrandCatalogImagePickerItem[] = [...buckets.values()].map((b) => ({
    image_url: b.image_url,
    thumbnail_url: b.thumbnail_url,
    source_lines: [...b.lines].sort((a, x) => a.localeCompare(x)),
    is_focus_model: true,
    sort_model_name: b.sort_name,
  }))

  items.sort((a, b) => {
    const n = a.sort_model_name.localeCompare(b.sort_model_name)
    if (n !== 0) return n
    return a.image_url.localeCompare(b.image_url)
  })

  return items
}

export async function listBrandCatalogImagesPickerService(
  supabase: SupabaseClient,
  input: {
    brand_id: string
    focus_brand_model_id?: string | null
    source?: BrandCatalogImagePickerSource
  },
): Promise<{ ok: true; items: BrandCatalogImagePickerItem[] } | { ok: false; error: string }> {
  try {
    const source = input.source ?? "catalog"
    const focusId = input.focus_brand_model_id?.trim() || null

    if (source === "live_listings" || source === "sold_listings") {
      if (!focusId) {
        return { ok: false, error: "Model is required for listing photos" }
      }

      const listingSources =
        source === "live_listings"
          ? await listLiveListingImagesForBrandModelAdmin(supabase, focusId)
          : await listSoldListingImagesForBrandModelAdmin(supabase, focusId)

      return {
        ok: true,
        items: bucketListingImages(listingSources, source === "live_listings" ? "live" : "sold"),
      }
    }

    const catalogSources = await listBrandCatalogImageSourcesForAdmin(supabase, input.brand_id)

    const buckets = new Map<
      string,
      {
        image_url: string
        lines: string[]
        focus: boolean
        sort_name: string
      }
    >()

    for (const s of catalogSources) {
      const key = catalogImageDedupeKey(s.image_url)
      if (!key) continue

      const line =
        s.kind === "model_hero"
          ? `${s.model_name} · Model photo`
          : s.variant_dims
            ? `${s.model_name} · ${formatBrandModelVariantLabel({
                ...s.variant_dims,
                price: s.variant_dims.price,
              })}`
            : `${s.model_name} · Variant`

      const matchesFocus = Boolean(focusId && s.brand_model_id === focusId)

      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          image_url: s.image_url.trim(),
          lines: [line],
          focus: matchesFocus,
          sort_name: s.model_name,
        })
      } else {
        if (!existing.lines.includes(line)) existing.lines.push(line)
        existing.focus = existing.focus || matchesFocus
        if (s.model_name.localeCompare(existing.sort_name) < 0) {
          existing.sort_name = s.model_name
        }
      }
    }

    const items: BrandCatalogImagePickerItem[] = [...buckets.values()].map((b) => ({
      image_url: b.image_url,
      source_lines: [...b.lines].sort((a, x) => a.localeCompare(x)),
      is_focus_model: b.focus,
      sort_model_name: b.sort_name,
    }))

    items.sort((a, b) => {
      if (a.is_focus_model !== b.is_focus_model) return a.is_focus_model ? -1 : 1
      const n = a.sort_model_name.localeCompare(b.sort_model_name)
      if (n !== 0) return n
      return a.image_url.localeCompare(b.image_url)
    })

    return { ok: true, items }
  } catch {
    return { ok: false, error: "Could not load catalog images" }
  }
}
