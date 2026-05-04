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

  return <SellFlowShell urlEditListingId={parseEditListingId(qs.edit)} />
}
