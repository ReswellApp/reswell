/**
 * REST (PostgREST) host for the primary project.
 * Catalog and analytics reads use this same URL as writes and auth.
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
