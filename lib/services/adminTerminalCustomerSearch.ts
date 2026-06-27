import { z } from "zod"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  searchProfilesForAdminMessaging,
  type AdminMarketplaceProfilePickerRow,
} from "@/lib/services/adminStartMarketplaceConversation"

const EMAIL_LIKE_RE = /@/

function normalizeEmailSearch(raw: string): string {
  return raw.trim().toLowerCase()
}

function isFullEmail(raw: string): boolean {
  return z.string().email().safeParse(normalizeEmailSearch(raw)).success
}

/** Auth login email when profiles.email is empty or stale (admin-only). */
async function findAuthUserByExactEmail(
  emailRaw: string,
): Promise<{ id: string; email: string } | null> {
  const normalized = normalizeEmailSearch(emailRaw)
  if (!normalized.includes("@")) return null

  const supabase = createServiceRoleClient()
  let page = 1

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data.users.length) return null

    const hit = data.users.find(
      (user) => !isAnonymousSupabaseUser(user) && user.email?.trim().toLowerCase() === normalized,
    )
    if (hit?.id && hit.email?.trim()) {
      return { id: hit.id, email: hit.email.trim() }
    }

    if (data.users.length < 1000) return null
    page++
  }

  return null
}

async function loadProfilePickerRow(
  userId: string,
  emailFallback: string | null,
): Promise<AdminMarketplaceProfilePickerRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data?.id) return null

  const profileEmail =
    typeof data.email === "string" && data.email.trim() ? data.email.trim() : emailFallback

  return {
    id: data.id,
    display_name: data.display_name ?? null,
    email: profileEmail,
    avatar_url: data.avatar_url ?? null,
  }
}

/**
 * Terminal member picker: name + profiles.email partial match, plus exact Auth email lookup.
 */
export async function searchAdminTerminalCustomers(
  searchRaw: string,
  limit: number,
): Promise<{ rows: AdminMarketplaceProfilePickerRow[]; error?: string }> {
  const term = searchRaw.trim()
  if (term.length < 2) {
    return { rows: [] }
  }

  const lim = Math.min(Math.max(limit, 1), 50)
  const byId = new Map<string, AdminMarketplaceProfilePickerRow>()

  const profileSearch = await searchProfilesForAdminMessaging(term, lim)
  if (profileSearch.error) {
    return profileSearch
  }

  for (const row of profileSearch.rows) {
    byId.set(row.id, row)
  }

  const shouldTryAuthEmail = isFullEmail(term)
  if (shouldTryAuthEmail) {
    const authHit = await findAuthUserByExactEmail(term)
    if (authHit && !byId.has(authHit.id)) {
      const row = await loadProfilePickerRow(authHit.id, authHit.email)
      if (row) {
        byId.set(row.id, row)
      }
    }
  }

  const rows = Array.from(byId.values())
    .sort((a, b) => {
      const aEmail = a.email?.toLowerCase() ?? ""
      const bEmail = b.email?.toLowerCase() ?? ""
      const normalized = normalizeEmailSearch(term)

      if (EMAIL_LIKE_RE.test(term)) {
        const aExact = aEmail === normalized
        const bExact = bEmail === normalized
        if (aExact !== bExact) return aExact ? -1 : 1
        const aStarts = aEmail.startsWith(normalized)
        const bStarts = bEmail.startsWith(normalized)
        if (aStarts !== bStarts) return aStarts ? -1 : 1
      }

      return (a.display_name ?? a.email ?? "").localeCompare(
        b.display_name ?? b.email ?? "",
        undefined,
        { sensitivity: "base" },
      )
    })
    .slice(0, lim)

  return { rows }
}
