import { Suspense } from "react"
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
  return (
    <main className="flex-1 w-full bg-muted pt-8 pb-16 md:pb-20 lg:pb-24">
      <div className="container relative mx-auto flex max-w-2xl min-h-[40vh] items-center justify-center lg:max-w-6xl">
        <p className="text-sm text-muted-foreground">Loading listing editor…</p>
      </div>
    </main>
  )
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
