import type { SupabaseClient } from "@supabase/supabase-js"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import { isAbortError } from "@/lib/utils/is-abort-error"

const IMAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://www.facebook.com/",
  "Sec-Fetch-Dest": "image",
  "Sec-Fetch-Mode": "no-cors",
  "Sec-Fetch-Site": "cross-site",
} as const

function extensionFromContentType(contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase()
  if (ct.includes("webp")) return "webp"
  if (ct.includes("png")) return "png"
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg"
  return "jpg"
}

export async function mirrorExternalListingImagesToStorage(opts: {
  supabase: SupabaseClient
  userId: string
  imageUrls: string[]
}): Promise<Array<{ url: string; thumbnail_url: string }>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")

  const results: Array<{ url: string; thumbnail_url: string }> = []

  for (let i = 0; i < opts.imageUrls.length; i++) {
    const sourceUrl = opts.imageUrls[i]?.trim()
    if (!sourceUrl) continue

    try {
      const res = await fetch(sourceUrl, {
        headers: IMAGE_FETCH_HEADERS,
        redirect: "follow",
        cache: "no-store",
      })
      if (!res.ok) continue

      const contentType = res.headers.get("content-type")
      const ext = extensionFromContentType(contentType)
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.byteLength < 512) continue

      const path = `${opts.userId}/import-${Date.now()}-${i}.${ext}`
      const { error } = await opts.supabase.storage.from("listings").upload(path, bytes, {
        upsert: false,
        contentType: contentType?.split(";")[0]?.trim() || "image/jpeg",
        cacheControl: "31536000",
      })
      if (error) {
        console.warn("[import listing images] upload:", error.message)
        continue
      }

      const publicUrl = listingObjectPublicUrl(supabaseUrl, path)
      results.push({ url: publicUrl, thumbnail_url: publicUrl })
    } catch (err) {
      if (!isAbortError(err)) {
        console.warn("[import listing images] fetch:", err)
      }
    }
  }

  return results
}
