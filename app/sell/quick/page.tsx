import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { resolveDefaultSurfboardSellCreatePath } from "@/lib/services/surfboardSellEntry"
import {
  SURFBOARD_SELL_BOARDS_CREATE_HREF,
  isSurfboardQuickCreatePath,
} from "@/lib/sell-flow/surfboard-sell-paths"
import { createClient } from "@/lib/supabase/server"
import QuickListClient from "./quick-list-client"

export const metadata: Metadata = {
  title: "Quick List | Reswell",
  description:
    "List your surfboard in seconds — add a photo, title, description, price, and local pickup location.",
  alternates: { canonical: "/sell/quick" },
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

/**
 * Quick List — photo-first, single-screen surfboard listing (pickup-only).
 * Brand-new listings only; editing stays with the full wizard (`/sell/boards?edit=`).
 *
 * Returning publishers who hit `?new=1` are sent to Guided boards.
 * View-picker forks use `/sell/quick` without `?new=1` and stay here.
 */
export default async function QuickListPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[] }>
}) {
  const qs = await searchParams
  const wantsNew = firstParam(qs.new) === "1"

  if (wantsNew) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const defaultPath = await resolveDefaultSurfboardSellCreatePath(supabase, user?.id)
    if (!isSurfboardQuickCreatePath(defaultPath)) {
      redirect(SURFBOARD_SELL_BOARDS_CREATE_HREF)
    }
  }

  return (
    <Suspense fallback={null}>
      <QuickListClient />
    </Suspense>
  )
}
