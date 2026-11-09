import { publicStorageObjectUrl } from "@/lib/supabase/storage-upload-xhr"

/** Buckets with `public = true` — verifiable in the browser without the service role. */
const PUBLIC_STORAGE_BUCKETS = new Set(["listings"])

function encodeStorageObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

async function storageObjectHeadExists(bucket: string, path: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!supabaseUrl) return false

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectPath(path)}`,
      {
        method: "HEAD",
        headers: { Authorization: `Bearer ${serviceKey}` },
      },
    )
    return res.ok
  }

  if (PUBLIC_STORAGE_BUCKETS.has(bucket)) {
    const res = await fetch(publicStorageObjectUrl(supabaseUrl, bucket, path), {
      method: "HEAD",
      cache: "no-store",
    })
    return res.ok
  }

  return false
}

/**
 * Confirms an object is readable in storage after upload.
 * Server code uses the service role; browser code uses public URLs for public buckets.
 * Retries briefly because storage can lag right after POST.
 */
export async function verifyStorageObjectExists(
  bucket: string,
  path: string,
  retries = 3,
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (await storageObjectHeadExists(bucket, path)) return true
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  return false
}
