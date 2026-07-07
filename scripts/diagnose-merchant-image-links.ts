import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { googleMerchantProductLink } from "../lib/google-merchant/product-link"
import {
  googleMerchantListingImageSourceUrl,
  googleMerchantListingImageUrl,
} from "../lib/google-merchant/product-image-link"
import {
  isGoogleMerchantEligibleListing,
  mapListingToProductInput,
  type GoogleMerchantListingRow,
} from "../lib/google-merchant/map-listing-to-product-input"

function loadEnvFile(relativePath: string): void {
  try {
    const filePath = resolve(process.cwd(), relativePath)
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

type ImageProbe = {
  listingId: string
  title: string
  slug: string | null
  listingUrl: string
  imageLink: string
  usesMerchantVariant: boolean
  sourceExt: string | null
  status: number | null
  contentType: string | null
  contentLength: number | null
  error: string | null
  ok: boolean
}

async function supabaseFetch<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error("Missing Supabase env")

  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

async function probeImageUrl(
  listingId: string,
  title: string,
  slug: string | null,
  imageLink: string,
): Promise<ImageProbe> {
  const listingUrl = googleMerchantProductLink({ id: listingId, slug })
  const usesMerchantVariant = imageLink.includes("variant=merchant")
  const sourceExt = imageLink.split("?")[0]?.split(".").pop()?.toLowerCase() ?? null

  try {
    const res = await fetch(imageLink, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "Googlebot-Image/1.0",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(15_000),
    })

    const contentType = res.headers.get("content-type")
    const lenRaw = res.headers.get("content-length")
    const contentLength = lenRaw ? Number.parseInt(lenRaw, 10) : null
    const ok =
      res.ok &&
      Boolean(contentType?.startsWith("image/")) &&
      (contentLength == null || contentLength > 0)

    return {
      listingId,
      title,
      slug,
      listingUrl,
      imageLink,
      usesMerchantVariant,
      sourceExt,
      status: res.status,
      contentType,
      contentLength: Number.isFinite(contentLength) ? contentLength : null,
      error: ok ? null : `HTTP ${res.status}${contentType ? ` · ${contentType}` : ""}`,
      ok,
    }
  } catch (e) {
    return {
      listingId,
      title,
      slug,
      listingUrl,
      imageLink,
      usesMerchantVariant,
      sourceExt,
      status: null,
      contentType: null,
      contentLength: null,
      error: e instanceof Error ? e.message : String(e),
      ok: false,
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env.production.local")

  const select = [
    "id",
    "slug",
    "title",
    "description",
    "price",
    "condition",
    "brand",
    "model",
    "section",
    "status",
    "hidden_from_site",
    "archived_at",
    "shipping_available",
    "shipping_price",
    "board_shipping_cost_mode",
    "listing_images(url,thumbnail_url,is_primary,sort_order)",
  ].join(",")

  const all: GoogleMerchantListingRow[] = []
  const pageSize = 200
  for (let offset = 0; ; offset += pageSize) {
    const rows = await supabaseFetch<GoogleMerchantListingRow[]>(
      `listings?select=${encodeURIComponent(select)}&section=in.(surfboards,fins,magazines)&status=eq.active&hidden_from_site=eq.false&archived_at=is.null&order=updated_at.desc&offset=${offset}&limit=${pageSize}`,
    )
    if (!rows.length) break
    all.push(...rows)
    if (rows.length < pageSize) break
  }

  const eligible = all.filter((row) => isGoogleMerchantEligibleListing(row))
  console.log(`Eligible feed listings: ${eligible.length}\n`)

  const probes: ImageProbe[] = []
  const batchSize = 10
  for (let i = 0; i < eligible.length; i += batchSize) {
    const batch = eligible.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (listing) => {
        const payload = mapListingToProductInput(listing)
        const imageLink = payload?.productAttributes.imageLink
        if (!imageLink) return null
        return probeImageUrl(listing.id, listing.title, listing.slug, imageLink)
      }),
    )
    for (const result of results) {
      if (result) probes.push(result)
    }
  }

  const failed = probes.filter((p) => !p.ok)
  const variant = probes.filter((p) => p.usesMerchantVariant)
  const variantFailed = variant.filter((p) => !p.ok)
  const apexPrimary = probes.filter((p) => p.imageLink.includes("://reswell.app/")).length
  const wwwPrimary = probes.filter((p) => p.imageLink.includes("://www.reswell.app/")).length

  const additionalFailures: Array<{ listingId: string; title: string; url: string; error: string }> =
    []
  let additionalTotal = 0
  for (const listing of eligible) {
    const payload = mapListingToProductInput(listing)
    const extras = payload?.productAttributes.additionalImageLinks ?? []
    for (const url of extras) {
      additionalTotal += 1
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          headers: { "User-Agent": "Googlebot-Image/1.0", Accept: "image/*" },
          signal: AbortSignal.timeout(15_000),
        })
        const ct = res.headers.get("content-type")
        if (!res.ok || !ct?.startsWith("image/")) {
          additionalFailures.push({
            listingId: listing.id,
            title: listing.title,
            url,
            error: `HTTP ${res.status}${ct ? ` · ${ct}` : ""}`,
          })
        }
      } catch (e) {
        additionalFailures.push({
          listingId: listing.id,
          title: listing.title,
          url,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  console.log("=== Summary ===")
  console.log(`Site origin env: ${process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "(default www)"}`)
  console.log(`Total image_link URLs probed: ${probes.length}`)
  console.log(`Primary on apex reswell.app: ${apexPrimary}`)
  console.log(`Primary on www.reswell.app: ${wwwPrimary}`)
  console.log(`OK (200 + image/*): ${probes.length - failed.length}`)
  console.log(`Failed probe: ${failed.length}`)
  console.log(`Uses ?variant=merchant: ${variant.length} (${variantFailed.length} failed)`)
  console.log(`Additional images probed: ${additionalTotal} (${additionalFailures.length} failed)`)
  console.log("")

  if (apexPrimary > 0) {
    const sample = probes.find((p) => p.imageLink.includes("://reswell.app/"))
    if (sample) {
      try {
        const res = await fetch(sample.imageLink, {
          method: "HEAD",
          redirect: "manual",
          headers: { "User-Agent": "Googlebot-Image/1.0", Accept: "image/*" },
          signal: AbortSignal.timeout(15_000),
        })
        console.log("=== Apex host note ===")
        console.log(
          `Feed emits apex URLs (reswell.app). Sample HEAD without redirect: HTTP ${res.status}` +
            (res.headers.get("location") ? ` → ${res.headers.get("location")}` : ""),
        )
        console.log(
          "Google must follow a 308 to www on every image crawl. Prefer NEXT_PUBLIC_SITE_URL=https://www.reswell.app in production.",
        )
        console.log("")
      } catch {
        // ignore
      }
    }
  }

  if (failed.length > 0) {
    console.log("=== FAILED image_link (likely image_link_internal_error) ===")
    for (const p of failed) {
      console.log(`\n${p.title}`)
      console.log(`  listing: ${p.listingUrl}`)
      console.log(`  image:   ${p.imageLink}`)
      console.log(`  variant: ${p.usesMerchantVariant ? "yes" : "no"} · ext: ${p.sourceExt ?? "?"}`)
      console.log(`  error:   ${p.error}`)
    }
    console.log("")
  }

  if (variant.length > 0) {
    console.log("=== Uses on-demand ?variant=merchant (higher Google failure risk) ===")
    for (const p of variant) {
      console.log(`- ${p.title} · ${p.ok ? "OK" : "FAIL"} · ${p.imageLink}`)
    }
    console.log("")
  }

  const nonStandard: ImageProbe[] = []
  for (const listing of eligible) {
    const images = listing.listing_images ?? []
    const primary = images.find((i) => i.is_primary) ?? images[0]
    const source = primary ? googleMerchantListingImageSourceUrl(primary) : null
    const imageLink = source ? googleMerchantListingImageUrl(source) : null
    if (!source || !imageLink) continue
    const pathOnly = source.split("?")[0] ?? source
    if (!pathOnly.includes("-full.") && !imageLink.includes("variant=merchant")) {
      const probe = probes.find((p) => p.listingId === listing.id)
      if (probe) nonStandard.push(probe)
    }
  }

  if (additionalFailures.length > 0) {
    console.log("=== FAILED additional_image_link ===")
    for (const row of additionalFailures) {
      console.log(`- ${row.title} · ${row.url} · ${row.error}`)
    }
    console.log("")
  }

  if (nonStandard.length > 0) {
    console.log("=== Non -full.webp static paths (legacy uploads) ===")
    for (const p of nonStandard.slice(0, 30)) {
      console.log(`- ${p.title} · ${p.ok ? "OK" : "FAIL"} · ${p.imageLink}`)
    }
    if (nonStandard.length > 30) console.log(`  … and ${nonStandard.length - 30} more`)
    console.log("")
  }

  console.log("=== CSV (all failed) ===")
  console.log("listing_id,title,listing_url,image_url,uses_variant,error")
  for (const p of failed) {
    console.log(
      [
        p.listingId,
        p.title,
        p.listingUrl,
        p.imageLink,
        p.usesMerchantVariant ? "yes" : "no",
        p.error ?? "",
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    )
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
