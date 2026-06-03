/** Hosts serving our Supabase public Storage buckets (project URL or custom domain). */
export function isOurPublicStorageMediaHost(hostname: string): boolean {
  return hostname === "app.reswell.app" || hostname.endsWith(".supabase.co")
}
