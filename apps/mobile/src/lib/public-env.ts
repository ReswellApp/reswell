/**
 * Same public variables as the website. Metro inlines them from the repo
 * `.env.local` / `.env`. Server secrets are never read here.
 */
export function publicSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
}

export function publicSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
}

/**
 * Local Expo talks to the Next dev server. `NEXT_PUBLIC_SITE_URL` stays the
 * production site even in `.env.local`, so it is not the API origin.
 */
export function publicApiUrl(): string {
  return process.env.NEXT_PUBLIC_URL?.trim() || "http://localhost:3000"
}
