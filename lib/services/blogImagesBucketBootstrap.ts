import { createServiceRoleClient } from "@/lib/supabase/server"
import { BLOG_IMAGES_BUCKET } from "@/lib/blog/blog-images-bucket"

/**
 * Ensures `blog-images` exists in Storage (via service role row in `storage.buckets`).
 * RLS policies on `storage.objects` still come from migrations.
 */
export async function ensureBlogImagesBucket(): Promise<
  { ok: true; created: boolean } | { ok: false; error: string; skippedReason?: string }
> {
  let admin: ReturnType<typeof createServiceRoleClient>
  try {
    admin = createServiceRoleClient()
  } catch {
    return {
      ok: false,
      skippedReason: "missing_service_role",
      error:
        "Set SUPABASE_SERVICE_ROLE_KEY locally or push Supabase migrations so the `blog-images` bucket exists.",
    }
  }

  const { data: buckets, error: listErr } = await admin.storage.listBuckets()
  if (listErr) {
    console.error("ensureBlogImagesBucket listBuckets:", listErr.message)
    return { ok: false, error: listErr.message }
  }

  const exists = buckets?.some((b) => b.id === BLOG_IMAGES_BUCKET)
  if (exists) {
    return { ok: true, created: false }
  }

  const { error } = await admin.storage.createBucket(BLOG_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: 8_388_608,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  })

  if (error) {
    const msg = error.message ?? "createBucket failed"
    if (/already exists|duplicate/i.test(msg)) {
      return { ok: true, created: false }
    }
    console.error("ensureBlogImagesBucket createBucket:", msg)
    return { ok: false, error: msg }
  }

  return { ok: true, created: true }
}
