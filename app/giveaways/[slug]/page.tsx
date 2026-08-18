import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { GiveawayDetail } from "@/components/features/giveaways/giveaway-detail"
import { GiveawayHero } from "@/components/features/giveaways/giveaway-hero"
import { getGiveawayEntryForUser } from "@/lib/db/giveawayEntries"
import {
  getGiveawayBySlug,
  listGiveaways,
} from "@/lib/giveaways/catalog"
import { parseGiveawayBrandParam } from "@/lib/giveaways/intent-storage"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ brand?: string | string[] }>
}

export function generateStaticParams() {
  return listGiveaways().map((giveaway) => ({ slug: giveaway.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const giveaway = getGiveawayBySlug(slug)
  if (!giveaway) {
    return { title: "Giveaway | Reswell" }
  }
  const managedKey = `giveaway-${giveaway.slug}`
  if (getManagedPage(managedKey)) {
    return resolvePageMetadata(managedKey)
  }
  return {
    title: `${giveaway.title} | Reswell`,
    description: giveaway.summary,
    alternates: { canonical: `/giveaways/${giveaway.slug}` },
  }
}

export default async function GiveawayDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { brand: brandParam } = await searchParams
  const giveaway = getGiveawayBySlug(slug)
  if (!giveaway) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const entry = user
    ? await getGiveawayEntryForUser(supabase, user.id, giveaway.slug)
    : null
  const brandFromUrl = parseGiveawayBrandParam(
    Array.isArray(brandParam) ? brandParam[0] : brandParam,
  )

  return (
    <main className="flex-1">
      <GiveawayHero giveaway={giveaway} />
      <section className="relative z-10 -mt-6 rounded-t-3xl bg-background sm:-mt-8">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
          <GiveawayDetail
            giveaway={giveaway}
            isLoggedIn={Boolean(user)}
            initialEntry={entry}
            initialBrand={brandFromUrl}
          />
        </div>
      </section>
    </main>
  )
}
