/**
 * Same public variables as the website. Metro inlines them from the repo
 * `.env.local` / `.env`. Server secrets are never read here.
 * EAS inlines the same names from the build environment.
 */
function cleanPublicEnv(value: string | undefined): string {
  let next = value?.trim() ?? ""
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim()
  }
  return next
}

export function publicSupabaseUrl(): string {
  return cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function publicSupabaseAnonKey(): string {
  return cleanPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Local Expo talks to the Next dev server. `NEXT_PUBLIC_SITE_URL` stays the
 * production site even in `.env.local`, so it is not the API origin.
 *
 * `https://reswell.app` 308s to `https://www.reswell.app`. That is a different
 * origin, so the phone drops `Authorization` while following the redirect and
 * every signed-in API call comes back as "Sign in required".
 */
export function publicApiUrl(): string {
  const configured = cleanPublicEnv(process.env.NEXT_PUBLIC_URL) || "http://localhost:3000"
  return configured.replace(/^https:\/\/reswell\.app(?=\/|$)/i, "https://www.reswell.app")
}

/** Public storefront links (share, deep links). */
export function publicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.reswell.app"
}

/** Google OAuth Web client ID — must match Supabase Auth → Google provider. */
export function publicGoogleWebClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ??
    process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ??
    ""
  )
}

/** Google OAuth iOS client ID (`*.apps.googleusercontent.com`). */
export function publicGoogleIosClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? ""
}
