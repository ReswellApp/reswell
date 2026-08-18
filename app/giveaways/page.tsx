import type { Metadata } from "next"
import { GiveawaysHub } from "@/components/features/giveaways/giveaways-hub"
import { listCurrentGiveaways } from "@/lib/giveaways/catalog"
import { parseGiveawayBrandParam } from "@/lib/giveaways/intent-storage"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { createClient } from "@/lib/supabase/server"

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("giveaways")
}

export const revalidate = 3600

type PageProps = {
  searchParams: Promise<{ brand?: string | string[] }>
}

export default async function GiveawaysPage({ searchParams }: PageProps) {
  const { brand: brandParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const giveaways = listCurrentGiveaways()
  const initialBrand = parseGiveawayBrandParam(
    Array.isArray(brandParam) ? brandParam[0] : brandParam,
  )

  return (
    <main className="flex-1">
      <GiveawaysHub
        giveaways={giveaways}
        isLoggedIn={Boolean(user)}
        initialBrand={initialBrand}
      />
    </main>
  )
}
