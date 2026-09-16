import { after } from "next/server"
import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  generateAndStoreDraft,
  warmOpenSupportReplyDraftsService,
} from "@/lib/services/supportReplyDraft"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const CASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Inbound enqueue: GET ?case_id= returns 202 and writes the draft after the
 * response so the customer-facing request does not sit on the model.
 * Backup warmer (no case_id) covers tickets whose inbound generate was missed.
 * Protected with CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const caseId = new URL(request.url).searchParams.get("case_id")?.trim() ?? ""
  if (caseId) {
    if (!CASE_ID.test(caseId)) {
      return NextResponse.json({ error: "Invalid case." }, { status: 400 })
    }
    after(async () => {
      try {
        const service = createServiceRoleClient()
        const result = await generateAndStoreDraft(service, caseId, false)
        if ("error" in result) {
          console.warn("[cron] support-reply-drafts case:", result.error)
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error("[cron] support-reply-drafts case failed:", msg)
      }
    })
    return NextResponse.json({ queued: true, case_id: caseId }, { status: 202 })
  }

  try {
    const summary = await warmOpenSupportReplyDraftsService()
    return NextResponse.json({ summary, reference_time: new Date().toISOString() })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[cron] support-reply-drafts failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
