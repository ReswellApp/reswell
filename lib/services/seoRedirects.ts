import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createSeoRedirect,
  deleteSeoRedirect,
  listSeoRedirects,
  updateSeoRedirect,
  type SeoRedirectRow,
} from "@/lib/db/seo-redirects"
import type { SeoRedirectWriteInput } from "@/lib/validations/seo-redirects"

export type { SeoRedirectRow }

function toColumns(input: SeoRedirectWriteInput) {
  return {
    from_path: input.fromPath,
    to_path: input.toPath,
    status_code: input.statusCode,
    enabled: input.enabled,
    note: input.note,
  }
}

export function listSeoRedirectsService(supabase: SupabaseClient): Promise<SeoRedirectRow[]> {
  return listSeoRedirects(supabase)
}

export async function createSeoRedirectService(
  supabase: SupabaseClient,
  input: SeoRedirectWriteInput,
  updatedBy: string | null,
) {
  // Guard against an obvious one-hop loop (A→B where B→A already exists is still allowed at the
  // DB level, but a self-redirect is blocked here and by the CHECK constraint).
  return createSeoRedirect(supabase, toColumns(input), updatedBy)
}

export async function updateSeoRedirectService(
  supabase: SupabaseClient,
  id: string,
  input: SeoRedirectWriteInput,
  updatedBy: string | null,
) {
  return updateSeoRedirect(supabase, id, toColumns(input), updatedBy)
}

export function deleteSeoRedirectService(supabase: SupabaseClient, id: string) {
  return deleteSeoRedirect(supabase, id)
}
