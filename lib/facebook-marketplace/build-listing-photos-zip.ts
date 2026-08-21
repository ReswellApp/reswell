import { ZipArchive } from "archiver"
import { Readable } from "node:stream"
import type { SupabaseClient } from "@supabase/supabase-js"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-proxy-url"
import { slugify } from "@/lib/slugify"

const LISTINGS_BUCKET = "listings"
const IMAGE_FETCH_TIMEOUT_MS = 25_000
const MAX_IMAGE_BYTES = 30 * 1024 * 1024

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
}

export type FacebookMarketplacePhotoZipListing = {
  id: string
  slug: string | null
  title: string
  price: number
  image_urls: string[]
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function padIndex(index: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return String(index).padStart(width, "0")
}

export function listingFolderName(
  index: number,
  total: number,
  listing: { title: string; slug: string | null; id: string },
): string {
  const slug =
    slugify(listing.title) || slugify(listing.slug ?? "") || listing.id.slice(0, 8)
  return `${padIndex(index, total)}-${slug}`
}

function extensionFromUrlOrType(url: string, contentType: string | null | undefined): string {
  const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  const fromType = CONTENT_TYPE_EXTENSION[type]
  if (fromType) return fromType
  const path = (url.split("?")[0] ?? "").trim()
  const match = path.match(/\.([a-zA-Z0-9]{2,5})$/)
  if (!match) return "jpg"
  const ext = match[1]!.toLowerCase()
  return ext === "jpeg" ? "jpg" : ext
}

function bucketPathFromListingImageUrl(url: string): string | null {
  return listingStorageObjectPathFromUrl(url)
}

export async function downloadListingImageForZip(
  supabase: SupabaseClient,
  url: string,
): Promise<{ bytes: Buffer; extension: string } | null> {
  const bucketPath = bucketPathFromListingImageUrl(url)
  if (bucketPath) {
    const { data, error } = await supabase.storage.from(LISTINGS_BUCKET).download(bucketPath)
    if (!error && data) {
      const bytes = Buffer.from(await data.arrayBuffer())
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
      return { bytes, extension: extensionFromUrlOrType(url, data.type) }
    }
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
    return { bytes, extension: extensionFromUrlOrType(url, res.headers.get("content-type")) }
  } catch {
    return null
  }
}

function buildManifestCsv(
  listings: Array<FacebookMarketplacePhotoZipListing & { folder: string }>,
): string {
  const header = "index,folder,title,listing_id,price,image_count"
  const rows = listings.map((listing, i) =>
    [
      String(i + 1),
      csvCell(listing.folder),
      csvCell(listing.title),
      listing.id,
      String(Math.round(listing.price)),
      String(listing.image_urls.length),
    ].join(","),
  )
  return [header, ...rows].join("\n") + "\n"
}

export function startFacebookMarketplaceListingPhotosZip(opts: {
  rootFolder: string
  listings: FacebookMarketplacePhotoZipListing[]
  downloadImage: (url: string) => Promise<{ bytes: Buffer; extension: string } | null>
}): { archive: ZipArchive; done: Promise<{ added: number; failed: number }> } {
  const archive = new ZipArchive({ zlib: { level: 5 } })
  archive.on("warning", (error) => {
    console.error("facebookMarketplace listing photos zip warning:", error)
  })

  const prepared = opts.listings.map((listing, i) => ({
    ...listing,
    folder: listingFolderName(i + 1, opts.listings.length, listing),
  }))

  const done = (async () => {
    let added = 0
    let failed = 0
    const failures: string[] = []
    const root = opts.rootFolder

    archive.append(buildManifestCsv(prepared), { name: `${root}/listings.csv` })

    for (const listing of prepared) {
      const results = await Promise.all(
        listing.image_urls.map(async (url, imageIndex) => {
          const downloaded = await opts.downloadImage(url)
          return { url, imageIndex, downloaded }
        }),
      )

      for (const result of results) {
        if (!result.downloaded) {
          failed += 1
          failures.push(`${listing.folder}\t${result.url}`)
          continue
        }
        const filename = `${padIndex(result.imageIndex + 1, listing.image_urls.length)}.${result.downloaded.extension}`
        archive.append(result.downloaded.bytes, {
          name: `${root}/${listing.folder}/${filename}`,
        })
        added += 1
      }
    }

    if (failures.length > 0) {
      archive.append(`${failures.join("\n")}\n`, { name: `${root}/failed-downloads.txt` })
    }

    await archive.finalize()
    return { added, failed }
  })().catch((error: unknown) => {
    console.error("facebookMarketplace listing photos zip:", error)
    archive.destroy(error instanceof Error ? error : new Error("Could not build listing photos zip"))
    return { added: 0, failed: 0 }
  })

  return { archive, done }
}

export function zipArchiveToWebStream(archive: ZipArchive): ReadableStream<Uint8Array> {
  return Readable.toWeb(archive) as ReadableStream<Uint8Array>
}
