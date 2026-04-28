import type { SupabaseClient } from "@supabase/supabase-js"
import { listBrandCatalogImageSourcesForAdmin } from "@/lib/db/brand-catalog-images"
import { catalogImageDedupeKey } from "@/lib/utils/catalog-image-url"
import { formatBrandModelVariantLabel } from "@/lib/utils/brand-model-dimensions"

export type BrandCatalogImagePickerItem = {
  image_url: string
  /** One line per source (hero / variant) that uses this URL. */
  source_lines: string[]
  is_focus_model: boolean
  /** Lexical sort key: model name of first source. */
  sort_model_name: string
}

export async function listBrandCatalogImagesPickerService(
  supabase: SupabaseClient,
  input: { brand_id: string; focus_brand_model_id?: string | null },
): Promise<{ ok: true; items: BrandCatalogImagePickerItem[] } | { ok: false; error: string }> {
  try {
    const sources = await listBrandCatalogImageSourcesForAdmin(supabase, input.brand_id)
    const focusId = input.focus_brand_model_id?.trim() || null

    const buckets = new Map<
      string,
      {
        image_url: string
        lines: string[]
        focus: boolean
        sort_name: string
      }
    >()

    for (const s of sources) {
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
