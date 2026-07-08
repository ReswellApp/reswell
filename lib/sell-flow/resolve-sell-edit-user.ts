import type { SupabaseClient, User } from "@supabase/supabase-js"

import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

async function fetchServerSessionUser(): Promise<Pick<User, "id" | "email"> | null> {
  const ready = await waitForServerSessionReady({ maxAttempts: 24, msBetween: 75 })
  if (!ready) return null

  try {
    const res = await fetch("/api/auth/session-user", {
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: { id?: string; email?: string | null } }
    const id = body.data?.id?.trim()
    if (!id) return null
    return { id, email: body.data?.email ?? undefined }
  } catch {
    return null
  }
}

/** Session-safe user lookup for /sell edit hydration (avoids getUser() race after auth gate). */
export async function resolveSellEditUser(supabase: SupabaseClient): Promise<User | null> {
  const session = await resolveClientSessionForMutation(supabase)
  if (session?.user) return session.user

  const serverUser = await fetchServerSessionUser()
  if (!serverUser) return null

  return serverUser as User
}
