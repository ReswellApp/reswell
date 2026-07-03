function encodeStorageObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

async function storageObjectHeadExists(bucket: string, path: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return false

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectPath(path)}`,
    {
      method: "HEAD",
      headers: { Authorization: `Bearer ${serviceKey}` },
    },
  )
  return res.ok
}

/**
 * Confirms an object is readable in storage after a client upload.
 * Retries briefly because list/search can lag right after POST.
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
