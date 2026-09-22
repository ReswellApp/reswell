/**
 * REST (PostgREST) hosts. A Supabase dashboard replica is often Postgres-only;
 * `SUPABASE_READ_REPLICA_URL` must be an HTTPS API URL, not postgres://.
 */

export function isSupabaseRestUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    )
  } catch {
    return false
  }
}

export function supabasePrimaryRestUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example).",
    )
  }
  if (!isSupabaseRestUrl(url)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be an HTTP or HTTPS PostgREST URL (https://<ref>.supabase.co).",
    )
  }
  return url
}

export function supabaseReplicaRestUrl(): string | null {
  const url = process.env.SUPABASE_READ_REPLICA_URL?.trim()
  if (!url) return null
  if (!isSupabaseRestUrl(url)) {
    console.warn(
      "[supabase] SUPABASE_READ_REPLICA_URL is not an HTTP(S) PostgREST URL; using primary. Use https://<ref>.supabase.co, not a postgres:// connection string.",
    )
    return null
  }
  return url
}

/** Replica REST URL when configured and valid; otherwise primary. */
export function supabaseReadRestUrl(): string {
  return supabaseReplicaRestUrl() ?? supabasePrimaryRestUrl()
}
