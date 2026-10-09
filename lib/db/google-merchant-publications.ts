import type { SupabaseClient } from "@supabase/supabase-js"

const LAST_ERROR_MAX = 500

export type GoogleMerchantPublicationWriteResult = { error: string | null }

function publicationErrorText(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= LAST_ERROR_MAX) return trimmed
  return trimmed.slice(0, LAST_ERROR_MAX)
}

export async function listDueGoogleMerchantListingIds(
  supabase: SupabaseClient,
  input: {
    publishedBefore: Date
    attemptBefore: Date
    sections: readonly string[]
    limit: number
  },
): Promise<string[]> {
  const { data, error } = await supabase.rpc("list_due_google_merchant_listing_ids", {
    p_published_before: input.publishedBefore.toISOString(),
    p_attempt_before: input.attemptBefore.toISOString(),
    p_sections: [...input.sections],
    p_limit: input.limit,
  })

  if (error) {
    throw new Error(`list_due_google_merchant_listing_ids: ${error.message}`)
  }

  if (!Array.isArray(data)) return []

  const ids: string[] = []
  for (const row of data) {
    if (typeof row === "string" && row.trim()) {
      ids.push(row)
      continue
    }
    if (row && typeof row === "object" && "id" in row) {
      const id = (row as { id?: unknown }).id
      if (typeof id === "string" && id.trim()) ids.push(id)
    }
  }
  return ids
}

export async function recordGoogleMerchantPublicationSuccess(
  supabase: SupabaseClient,
  listingId: string,
  publishedAt: Date,
): Promise<GoogleMerchantPublicationWriteResult> {
  const iso = publishedAt.toISOString()
  const { error } = await supabase.from("listing_google_merchant_publications").upsert(
    {
      listing_id: listingId,
      published_at: iso,
      last_attempt_at: iso,
      last_error: null,
      updated_at: iso,
    },
    { onConflict: "listing_id" },
  )

  if (error) return { error: error.message }
  return { error: null }
}

export async function recordGoogleMerchantPublicationFailure(
  supabase: SupabaseClient,
  listingId: string,
  attemptedAt: Date,
  errorMessage: string,
  options?: { clearPublishedAt?: boolean },
): Promise<GoogleMerchantPublicationWriteResult> {
  const iso = attemptedAt.toISOString()
  const row: {
    listing_id: string
    last_attempt_at: string
    last_error: string
    updated_at: string
    published_at?: null
  } = {
    listing_id: listingId,
    last_attempt_at: iso,
    last_error: publicationErrorText(errorMessage),
    updated_at: iso,
  }
  if (options?.clearPublishedAt) row.published_at = null

  const { error } = await supabase
    .from("listing_google_merchant_publications")
    .upsert(row, { onConflict: "listing_id" })

  if (error) return { error: error.message }
  return { error: null }
}

export async function clearGoogleMerchantPublication(
  supabase: SupabaseClient,
  listingId: string,
): Promise<GoogleMerchantPublicationWriteResult> {
  const { error } = await supabase
    .from("listing_google_merchant_publications")
    .delete()
    .eq("listing_id", listingId)

  if (error) return { error: error.message }
  return { error: null }
}
