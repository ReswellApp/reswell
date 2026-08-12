import type { SupabaseClient } from "@supabase/supabase-js"

export type DemandCaptureByQuery = {
  query: string
  count: number
  /** Distinct shopper emails who asked for this term. */
  people: number
  lastAt: string
}

export type DemandCaptureAggregate = {
  total: number
  uniquePeople: number
  byQuery: DemandCaptureByQuery[]
}

const FETCH_CAP = 4000

function normalizeDemandQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200)
}

/**
 * Aggregates "notify me when listed" demand-capture rows (board_listing_requests)
 * by query for the range. Requires the service-role client (table is RLS-locked).
 * Volume is low, so rows are folded in JS rather than via an RPC.
 */
export async function aggregateDemandCaptureByQuery(
  service: SupabaseClient,
  fromIso: string,
  toIso?: string,
): Promise<DemandCaptureAggregate> {
  let q = service
    .from("board_listing_requests")
    .select("query, email, created_at")
    .gte("created_at", fromIso)
    .not("query", "is", null)
    .order("created_at", { ascending: false })
    .limit(FETCH_CAP)

  if (toIso) {
    q = q.lt("created_at", toIso)
  }

  const { data, error } = await q

  if (error) {
    console.error("aggregateDemandCaptureByQuery:", error.message)
    return { total: 0, uniquePeople: 0, byQuery: [] }
  }

  const rows = (data ?? []) as { query: string | null; email: string | null; created_at: string }[]
  const byQuery = new Map<
    string,
    { display: string; count: number; emails: Set<string>; lastAt: string }
  >()
  const allEmails = new Set<string>()
  let total = 0

  for (const r of rows) {
    const display = (r.query ?? "").trim()
    if (!display) continue
    total += 1
    const key = normalizeDemandQuery(display)
    const email = (r.email ?? "").trim().toLowerCase()
    if (email) allEmails.add(email)

    const existing = byQuery.get(key)
    if (existing) {
      existing.count += 1
      if (email) existing.emails.add(email)
      if (r.created_at > existing.lastAt) existing.lastAt = r.created_at
    } else {
      byQuery.set(key, {
        display,
        count: 1,
        emails: email ? new Set([email]) : new Set(),
        lastAt: r.created_at,
      })
    }
  }

  const list: DemandCaptureByQuery[] = [...byQuery.values()]
    .map((v) => ({
      query: v.display,
      count: v.count,
      people: v.emails.size,
      lastAt: v.lastAt,
    }))
    .sort((a, b) => b.count - a.count || b.people - a.people)
    .slice(0, 30)

  return { total, uniquePeople: allEmails.size, byQuery: list }
}
