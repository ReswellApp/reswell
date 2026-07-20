import { NextResponse } from "next/server"
import { recordPresenceHeartbeat } from "@/lib/services/presenceHeartbeat"

/**
 * Presence ping used by the global client heartbeat.
 * Kept as an API route (not a Server Action) so deploys cannot 404 open tabs
 * with "Failed to find Server Action" — see Next.js deploy skew.
 */
export async function POST() {
  const result = await recordPresenceHeartbeat()
  if (!result.ok) {
    return NextResponse.json(
      { ok: false as const, error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ ok: true as const }, { status: 200 })
}
