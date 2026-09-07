import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { slugify } from "@/lib/slugify"
import { RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"
import {
  normalizeReswellShopPackage,
  RESWELL_SHOP_DEFAULT_PACKAGE,
  reswellShopShippingPersistFields,
  type ReswellShopPackageInches,
} from "@/lib/reswell-shop-shipping"
import { persistableListingThumbnailUrl } from "@/lib/listing-media-proxy-url"
import { resolveReswellShopOwnerUserId } from "@/lib/services/resolveReswellShopOwnerUser"

export type ReswellShopAdminProduct = {
  id: string
  slug: string | null
  title: string
  description: string | null
  price: number
  stock_quantity: number
  status: string
  created_at: string | null
  image_urls: string[]
  package: ReswellShopPackageInches
}

export type ReswellShopProductInput = {
  title: string
  description: string
  price: number
  stock_quantity: number
  image_urls: string[]
  package: ReswellShopPackageInches
  status?: "active" | "sold" | "draft"
}

async function uniqueListingSlug(supabase: SupabaseClient, title: string): Promise<string> {
  const baseSlug = slugify(title) || "shop-item"
  let slug = baseSlug
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", baseSlug)
  if (!count) return slug
  for (let i = 2; i < 100; i++) {
    const candidate = `${baseSlug}-${i}`
    const { count: c } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate)
    if (!c) return candidate
  }
  return `${baseSlug}-${Date.now()}`
}

function packageFromListingRow(row: {
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
}): ReswellShopPackageInches {
  const lengthIn = Number(row.shipping_packed_length_in)
  const widthIn = Number(row.shipping_packed_width_in)
  const heightIn = Number(row.shipping_packed_height_in)
  const weightOz = Number(row.shipping_packed_weight_oz)
  const normalized = normalizeReswellShopPackage({
    lengthIn,
    widthIn,
    heightIn,
    weightLb: Number.isFinite(weightOz) && weightOz > 0 ? weightOz / 16 : NaN,
  })
  return normalized ?? { ...RESWELL_SHOP_DEFAULT_PACKAGE }
}

/**
 * All Reswell shop products (`section = new`). Any admin may list/edit.
 */
export async function listReswellShopAdminProducts(
  serviceSupabase: SupabaseClient,
): Promise<ReswellShopAdminProduct[]> {
  const { data, error } = await serviceSupabase
    .from("listings")
    .select(
      `
      id,
      slug,
      title,
      description,
      price,
      stock_quantity,
      status,
      created_at,
      shipping_packed_length_in,
      shipping_packed_width_in,
      shipping_packed_height_in,
      shipping_packed_weight_oz,
      listing_images ( url, sort_order, is_primary )
    `,
    )
    .eq("section", RESWELL_SHOP_SECTION)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error || !data) {
    console.error("[reswellShopAdmin] list:", error?.message)
    return []
  }

  return data.map((row) => {
    const imgs = (
      (row.listing_images as
        | { url: string; sort_order?: number | null; is_primary?: boolean | null }[]
        | null) ?? []
    )
      .slice()
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
      .map((i) => i.url)
      .filter(Boolean)

    return {
      id: row.id,
      slug: row.slug,
      title: String(row.title ?? ""),
      description: row.description ?? null,
      price: Number(row.price),
      stock_quantity: Math.max(0, Math.floor(Number(row.stock_quantity) || 0)),
      status: String(row.status ?? "active"),
      created_at: row.created_at ?? null,
      image_urls: imgs,
      package: packageFromListingRow(row),
    }
  })
}

export async function createReswellShopProduct(
  serviceSupabase: SupabaseClient,
  input: ReswellShopProductInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const pkg = normalizeReswellShopPackage(input.package)
  if (!pkg) {
    return { ok: false, error: "Enter a valid shipping box size and weight" }
  }

  const owner = await resolveReswellShopOwnerUserId(serviceSupabase)
  if (!owner.ok) {
    return { ok: false, error: owner.error }
  }

  const slug = await uniqueListingSlug(serviceSupabase, input.title)
  const stock = Math.max(0, Math.floor(input.stock_quantity))
  const status = input.status ?? (stock > 0 ? "active" : "sold")

  const { data: listing, error } = await serviceSupabase
    .from("listings")
    .insert({
      user_id: owner.userId,
      title: input.title.trim(),
      slug,
      description: input.description.trim(),
      price: input.price,
      section: RESWELL_SHOP_SECTION,
      category_id: null,
      stock_quantity: stock,
      status,
      condition: "brand_new",
      ...reswellShopShippingPersistFields(pkg),
    })
    .select("id")
    .single()

  if (error || !listing?.id) {
    console.error("[reswellShopAdmin] create:", error?.message)
    return { ok: false, error: error?.message ?? "Could not create product" }
  }

  const urls = input.image_urls.map((u) => u.trim()).filter(Boolean)
  if (urls.length > 0) {
    const { error: imgErr } = await serviceSupabase.from("listing_images").insert(
      urls.map((url, index) => ({
        listing_id: listing.id,
        url,
        thumbnail_url: persistableListingThumbnailUrl(null, url),
        is_primary: index === 0,
        sort_order: index,
      })),
    )
    if (imgErr) {
      console.error("[reswellShopAdmin] images:", imgErr.message)
    }
  }

  return { ok: true, id: listing.id }
}

export async function updateReswellShopProduct(
  serviceSupabase: SupabaseClient,
  listingId: string,
  input: ReswellShopProductInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pkg = normalizeReswellShopPackage(input.package)
  if (!pkg) {
    return { ok: false, error: "Enter a valid shipping box size and weight" }
  }

  const stock = Math.max(0, Math.floor(input.stock_quantity))
  const status = input.status ?? (stock > 0 ? "active" : "sold")

  const { data: existing, error: findErr } = await serviceSupabase
    .from("listings")
    .select("id, section, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (findErr || !existing) {
    return { ok: false, error: "Product not found" }
  }
  if (existing.section !== RESWELL_SHOP_SECTION) {
    return { ok: false, error: "Not a Reswell shop product" }
  }

  const { error } = await serviceSupabase
    .from("listings")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      price: input.price,
      category_id: null,
      stock_quantity: stock,
      status,
      ...reswellShopShippingPersistFields(pkg),
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  const urls = input.image_urls.map((u) => u.trim()).filter(Boolean)
  await serviceSupabase.from("listing_images").delete().eq("listing_id", listingId)
  if (urls.length > 0) {
    const { error: imgErr } = await serviceSupabase.from("listing_images").insert(
      urls.map((url, index) => ({
        listing_id: listingId,
        url,
        thumbnail_url: persistableListingThumbnailUrl(null, url),
        is_primary: index === 0,
        sort_order: index,
      })),
    )
    if (imgErr) {
      console.error("[reswellShopAdmin] update images:", imgErr.message)
      return { ok: false, error: "Could not update product photos" }
    }
  }

  // Shop PDP (`/l/...`) reads hourly `getCachedPublicShopListing` — bust it so rotated photos show.
  revalidateListingDetailPage(listingId, existing.slug)

  return { ok: true }
}

export async function archiveReswellShopProduct(
  serviceSupabase: SupabaseClient,
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await serviceSupabase
    .from("listings")
    .select("id, section, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (!existing || existing.section !== RESWELL_SHOP_SECTION) {
    return { ok: false, error: "Product not found" }
  }

  const { error } = await serviceSupabase
    .from("listings")
    .update({
      archived_at: new Date().toISOString(),
      status: "sold",
      stock_quantity: 0,
      hidden_from_site: true,
    })
    .eq("id", listingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidateListingDetailPage(listingId, existing.slug)
  return { ok: true }
}

