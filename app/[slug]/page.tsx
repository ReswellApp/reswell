import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { UsedGearSearchParams } from "@/components/used-gear-listings"
import { UsedAllGearPage } from "@/components/used-all-gear-page"
import { BoardsBrowsePage } from "@/components/boards-browse-page"
import { UsedCategoryBrowsePage } from "@/components/used-category-browse-page"
import {
  metadataForAllGear,
  metadataForBoardsBrowse,
  metadataForUsedCategoryBrowse,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"

function flattenSearchParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    o[k] = Array.isArray(v) ? v[0] : v
  }
  return o
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { slug } = await props.params
  const rawSp = await props.searchParams
  const flat = flattenSearchParams(rawSp)
  const usedSp = flat as UsedGearSearchParams

  if (slug === "gear") {
    return metadataForAllGear(usedSp)
  }
  if (slug === "boards") {
    return metadataForBoardsBrowse(flat as BoardsBrowseSearchParams)
  }

  const supabase = await createClient()
  const { data: usedCat } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("gear", true)
    .eq("slug", slug)
    .maybeSingle()

  if (usedCat) {
    return metadataForUsedCategoryBrowse(usedCat.slug, usedCat.name, usedSp)
  }

  return { title: "Reswell" }
}

export default async function MarketplaceSlugPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await props.params
  const searchParamsPromise = props.searchParams.then(
    (sp) => flattenSearchParams(sp) as UsedGearSearchParams,
  )

  if (slug === "gear") {
    return <UsedAllGearPage searchParams={searchParamsPromise} />
  }
  if (slug === "boards") {
    return (
      <BoardsBrowsePage
        searchParams={props.searchParams.then((sp) => flattenSearchParams(sp) as BoardsBrowseSearchParams)}
      />
    )
  }

  const supabase = await createClient()
  const { data: usedCat } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("gear", true)
    .eq("slug", slug)
    .maybeSingle()

  if (usedCat) {
    return <UsedCategoryBrowsePage category={usedCat} searchParams={searchParamsPromise} />
  }

  notFound()
}
