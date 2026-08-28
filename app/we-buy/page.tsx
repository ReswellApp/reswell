import { WeBuyLanding } from "@/components/features/board-buy/we-buy-landing"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata() {
  return resolvePageMetadata("we-buy")
}

export default async function WeBuyPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  return (
    <WeBuyLanding signedIn={Boolean(data.user) && !isAnonymousSupabaseUser(data.user)} />
  )
}
