import type { Metadata } from "next"
import { GiveawaysHub } from "@/components/features/giveaways/giveaways-hub"
import { listCurrentGiveaways } from "@/lib/giveaways/catalog"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("giveaways")
}

export const revalidate = 3600

export default async function GiveawaysPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const giveaways = listCurrentGiveaways()

  return (
    <main className="flex-1">
      <GiveawaysHub giveaways={giveaways} isLoggedIn={Boolean(user)} />
    </main>
  )
}
