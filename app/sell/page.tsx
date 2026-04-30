import type { SellDraftItem } from "@/components/features/sell/drafts-picker"
import { createClient } from "@/lib/supabase/server"
import { getSellListingAreaPrefillForUser } from "@/lib/db/sell-listing-area-prefill"
import { listSurfboardListingDrafts } from "@/lib/services/listingDraftAutosave"
import SellFlowShell from "./sell-flow-client"

function parseEditListingId(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[]; new?: string | string[] }>
}) {
  const qs = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initialSellListingAreaPrefill: Awaited<
    ReturnType<typeof getSellListingAreaPrefillForUser>
  > = null
  let initialSellDrafts: SellDraftItem[] = []

  if (user?.id) {
    const [pref, draftsRow] = await Promise.all([
      getSellListingAreaPrefillForUser(supabase, user.id),
      listSurfboardListingDrafts(supabase, user.id).catch(() => []),
    ])
    initialSellListingAreaPrefill = pref
    initialSellDrafts = draftsRow as SellDraftItem[]
  }

  return (
    <SellFlowShell
      initialSellListingAreaPrefill={initialSellListingAreaPrefill}
      initialSellDrafts={initialSellDrafts}
      urlEditListingId={parseEditListingId(qs.edit)}
    />
  )
}
