import { Suspense } from "react"
import { SellFlowRouteSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
import { SellTypeChooser } from "@/components/features/sell/sell-type-chooser"
import { createClient } from "@/lib/supabase/server"
import { actorCanManageWetsuitListings } from "@/lib/services/wetsuitListingSeller"
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

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

function SellPageSuspenseFallback() {
  return <SellFlowRouteSkeleton />
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string | string[]
    new?: string | string[]
    type?: string | string[]
  }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  const type = firstParam(qs.type)

  // Editing an existing listing or explicitly choosing surfboards goes straight
  // to the surfboard flow. A fresh /sell visit shows the product-type chooser
  // (fins continue to a dedicated /sell/fins flow).
  if (editId || type === "surfboard") {
    return (
      <Suspense fallback={<SellPageSuspenseFallback />}>
        <SellFlowShell urlEditListingId={editId} />
      </Suspense>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const showWetsuitsOption = user
    ? await actorCanManageWetsuitListings(supabase, user.id)
    : false

  return <SellTypeChooser showWetsuitsOption={showWetsuitsOption} />
}
