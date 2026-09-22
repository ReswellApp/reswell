/**
 * REST (PostgREST) hosts. A Supabase dashboard replica is often Postgres-only;
 * `SUPABASE_READ_REPLICA_URL` must be an HTTPS API URL, not postgres://.
 */

export function supabasePrimaryRestUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "Missing Supabase env: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local or .env (see .env.example).",
    )
  }
  return url
}

export function supabaseReplicaRestUrl(): string | null {
  const url = process.env.SUPABASE_READ_REPLICA_URL?.trim()
  return url || null
}

/** Replica REST URL when configured; otherwise primary. */
export function supabaseReadRestUrl(): string {
  return supabaseReplicaRestUrl() ?? supabasePrimaryRestUrl()
}
