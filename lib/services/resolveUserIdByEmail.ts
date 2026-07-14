import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function isValidEmail(raw: string): boolean {
  return z.string().email().safeParse(normalizeEmail(raw)).success
}

/** Exact Auth login email (service role; paginated). */
async function findAuthUserIdByExactEmail(
  supabase: SupabaseClient,
  emailRaw: string,
): Promise<string | null> {
  const normalized = normalizeEmail(emailRaw)
  if (!isValidEmail(normalized)) return null

  let page = 1
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data.users.length) return null

    const hit = data.users.find(
      (user) => !isAnonymousSupabaseUser(user) && user.email?.trim().toLowerCase() === normalized,
    )
    if (hit?.id) return hit.id

    if (data.users.length < 1000) return null
    page++
  }

  return null
}

/** Build email → user id map from Auth for a target set (single paginated scan). */
async function findAuthUserIdsByEmails(
  supabase: SupabaseClient,
  targetEmails: Set<string>,
): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  if (targetEmails.size === 0) return found

  let page = 1
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data.users.length) break

    for (const user of data.users) {
      if (isAnonymousSupabaseUser(user)) continue
      const email = user.email?.trim().toLowerCase()
      if (email && targetEmails.has(email) && user.id) {
        found.set(email, user.id)
      }
    }

    if (found.size >= targetEmails.size) break
    if (data.users.length < 1000) break
    page++
  }

  return found
}

async function findProfileUserIdByEmail(
  supabase: SupabaseClient,
  emailRaw: string,
): Promise<string | null> {
  const trimmed = emailRaw.trim()
  if (!isValidEmail(trimmed)) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", trimmed)
    .maybeSingle()

  if (error || !data?.id) return null
  return String(data.id)
}

/** Resolve a member id from profiles.email, then Auth login email. */
export async function findUserIdByEmail(
  supabase: SupabaseClient,
  emailRaw: string,
): Promise<string | null> {
  const profileHit = await findProfileUserIdByEmail(supabase, emailRaw)
  if (profileHit) return profileHit
  return findAuthUserIdByExactEmail(supabase, emailRaw)
}

/**
 * Batch email lookup: profiles first (case-insensitive), then one Auth scan for leftovers.
 */
export async function findUserIdsByEmails(
  supabase: SupabaseClient,
  emails: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const remaining = new Set<string>()

  for (const raw of emails) {
    const normalized = normalizeEmail(raw)
    if (!isValidEmail(normalized)) continue
    remaining.add(normalized)
  }

  await Promise.all(
    Array.from(remaining).map(async (normalized) => {
      const profileHit = await findProfileUserIdByEmail(supabase, normalized)
      if (profileHit) {
        result.set(normalized, profileHit)
        remaining.delete(normalized)
      }
    }),
  )

  if (remaining.size > 0) {
    const authHits = await findAuthUserIdsByEmails(supabase, remaining)
    for (const [email, userId] of authHits) {
      result.set(email, userId)
      remaining.delete(email)
    }
  }

  return result
}
