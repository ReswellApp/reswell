import { createClient } from "@/lib/supabase/server"
import { getSellListingAreaPrefillForUser } from "@/lib/db/sell-listing-area-prefill"
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

  if (user?.id) {
    initialSellListingAreaPrefill = await getSellListingAreaPrefillForUser(
      supabase,
      user.id,
    )
  }

  return (
    <SellFlowShell
      initialSellListingAreaPrefill={initialSellListingAreaPrefill}
      urlEditListingId={parseEditListingId(qs.edit)}
    />
  )
}
