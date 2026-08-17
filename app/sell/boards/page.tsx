import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { resolveDefaultSurfboardSellCreatePath } from "@/lib/services/surfboardSellEntry"
import {
  isSurfboardCatalogHandoffFromParam,
  isSurfboardQuickCreatePath,
} from "@/lib/sell-flow/surfboard-sell-paths"
import { createClient } from "@/lib/supabase/server"
import SellFlowShell from "../sell-flow-client"

const title = "Sell your surfboard — Reswell"
const description =
  "List your surfboard on Reswell in minutes: add photos, set your price, and ship to buyers nationwide."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "sell surfboard",
    "list surfboard",
    "used surfboard",
    "sell board",
    "Reswell",
  ],
  alternates: { canonical: "/sell/boards" },
  openGraph: {
    title,
    description,
    url: "/sell/boards",
    siteName: "Reswell",
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
}

function parseEditListingId(value: string | string[] | undefined): string | null {
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

export default async function SellBoardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string | string[]
    new?: string | string[]
    from?: string | string[]
  }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  const wantsNew = firstParam(qs.new) === "1"
  const fromCatalog = isSurfboardCatalogHandoffFromParam(firstParam(qs.from))

  // Fresh create only — guests / first-time publishers start on Quick List.
  // Mode switches from Quick use `/sell/boards` without `?new=1`, so they stay here.
  // Catalog search selections always stay on Guided (`from=catalog`).
  if (!editId && wantsNew && !fromCatalog) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const defaultPath = await resolveDefaultSurfboardSellCreatePath(supabase, user?.id)
    if (isSurfboardQuickCreatePath(defaultPath)) {
      redirect(defaultPath)
    }
  }

  // Null fallback: client owns editLoading; route skeleton was flashing on draft switches.
  return (
    <Suspense fallback={null}>
      <SellFlowShell urlEditListingId={editId} />
    </Suspense>
  )
}
