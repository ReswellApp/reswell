import { Suspense } from "react"
import { SellFlowRouteSkeleton } from "@/components/features/sell/sell-flow-route-skeleton"
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

function SellPageSuspenseFallback() {
  return <SellFlowRouteSkeleton />
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[]; new?: string | string[] }>
}) {
  const qs = await searchParams

  return (
    <Suspense fallback={<SellPageSuspenseFallback />}>
      <SellFlowShell urlEditListingId={parseEditListingId(qs.edit)} />
    </Suspense>
  )
}
