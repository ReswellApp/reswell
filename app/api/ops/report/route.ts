import { NextRequest, NextResponse } from "next/server"
import { opsClientReportSchema } from "@/lib/validations/ops"
import { reportClientOpsError, resolveOptionalUserId } from "@/lib/services/opsIngest"

/**
 * Public ingest endpoint for browser / boundary errors.
 * Validates payload, optionally attaches session user, stores via service role.
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsed = opsClientReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    // Soft rate limit: reject oversized bursts from one UA+path in a tiny memory window is overkill;
    // rely on payload size limits + fingerprinting. Reject empty/noise messages.
    if (parsed.data.message.length < 2) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const userId = await resolveOptionalUserId()
    const userAgent = req.headers.get("user-agent")

    const result = await reportClientOpsError(parsed.data, {
      userId,
      userAgent,
    })

    return NextResponse.json(
      {
        data: {
          groupId: result.group.id,
          referenceCode: result.group.reference_code,
          eventId: result.signalId,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error(
      "[api/ops/report]",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Could not record error" }, { status: 500 })
  }
}
