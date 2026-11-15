import type { Metadata } from "next"
import type { SiteClosureAccount } from "@/components/features/site-closure/site-closure-screen"
import { SiteClosureScreen } from "@/components/features/site-closure/site-closure-screen"
import { getOAuthAvatarUrl } from "@/lib/auth/profile-completion"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { headerDisplayName } from "@/lib/header-user-display"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { SITE_CLOSURE_DATE_LABEL } from "@/lib/site-closure"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Reswell has closed",
  description: `As of ${SITE_CLOSURE_DATE_LABEL}, Reswell has shut down. Sign in to view your earnings, purchases, and sales.`,
  robots: { index: false, follow: false },
}

function closureAvatarUrl(
  profile: {
    is_shop: boolean | null
    shop_logo_url: string | null
    avatar_url: string | null
  } | null,
  oauthAvatarUrl: string | null,
): string | null {
  const shopLogo = profile?.is_shop ? profile.shop_logo_url?.trim() : ""
  const avatar = profile?.avatar_url?.trim()
  const raw = shopLogo || avatar || (profile ? "" : oauthAvatarUrl)
  const display = raw ? profileMediaDisplaySrc(raw) : ""
  return display || null
}

async function loadSiteClosureAccount(): Promise<SiteClosureAccount | null> {
  const { supabase, user } = await getCachedRequestSession()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, shop_logo_url, is_shop")
    .eq("id", user.id)
    .maybeSingle()

  return {
    name: headerDisplayName(profile?.display_name, user),
    avatarUrl: closureAvatarUrl(profile, getOAuthAvatarUrl(user)),
  }
}

export default async function SiteClosurePage() {
  const account = await loadSiteClosureAccount()
  return <SiteClosureScreen account={account} />
}
