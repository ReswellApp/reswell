"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { grantAdminPilotReswellCredit } from "@/lib/services/reswellCreditAwards"
import { getAdminReswellCreditPilotBundle } from "@/lib/services/reswellCreditPilot"
import { creditCentsToUsd, usdToCreditCents } from "@/lib/reswell-credit-rates"

export async function getReswellCreditEarningsData() {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const, pilot: null }
  }

  const pilot = await getAdminReswellCreditPilotBundle(supabase, user.id)
  return { error: null, pilot }
}

export async function grantSelfAdminPilotReswellCredit(amountUsd: number) {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false as const, error: "Unauthorized" }

  const cents = usdToCreditCents(amountUsd)
  const dayKey = new Date().toISOString().slice(0, 10)
  const referenceId = `${user.id}:${dayKey}:${cents}`

  const result = await grantAdminPilotReswellCredit({
    supabase,
    userId: user.id,
    amountCents: cents,
    referenceId,
    description: `Admin pilot grant $${creditCentsToUsd(cents).toFixed(2)} Reswell Credit`,
  })

  if (!result.ok) return result
  return {
    ok: true as const,
    amountUsd: creditCentsToUsd(result.amountCents),
    balanceUsd: creditCentsToUsd(result.balanceCents),
  }
}
