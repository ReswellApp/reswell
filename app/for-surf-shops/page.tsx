import { ForSurfShopsLanding } from "@/components/features/marketing/for-surf-shops-landing"
import { PageStructuredData } from "@/components/seo/page-structured-data"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { FOR_SURF_SHOPS_PAGE_KEY } from "@/lib/for-surf-shops"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata() {
  return resolvePageMetadata(FOR_SURF_SHOPS_PAGE_KEY)
}

async function readSignedIn(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return Boolean(data.user) && !isAnonymousSupabaseUser(data.user)
  } catch (error) {
    console.error("[for-surf-shops] auth lookup failed", {
      message: error instanceof Error ? error.message : "unknown",
      timestamp: new Date().toISOString(),
    })
    return false
  }
}

export default async function ForSurfShopsPage() {
  const signedIn = await readSignedIn()

  return (
    <>
      <PageStructuredData pageKey={FOR_SURF_SHOPS_PAGE_KEY} />
      <ForSurfShopsLanding signedIn={signedIn} />
    </>
  )
}
