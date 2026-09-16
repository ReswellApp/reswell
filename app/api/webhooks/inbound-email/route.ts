import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import {
  InboundEmailMissingAuthError,
  InboundEmailSignatureError,
  InboundEmailTimestampError,
  inboundEmailWebhookSecret,
  verifyInboundEmailWebhookAuth,
} from "@/lib/inbound-email/webhook-signature"
import {
  applyInboundSupportEmail,
  hydrateInboundEmailFromResend,
} from "@/lib/services/supportInboundEmail"
import {
  genericInboundEmailSchema,
  normalizedInboundFromGeneric,
  normalizedInboundFromResend,
  resendEmailReceivedSchema,
  resendWebhookEnvelopeSchema,
} from "@/lib/validations/inbound-email-webhook"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Inbound customer replies to Support Tickets Response emails.
 *
 * Resend Receiving (or a mail-forward webhook) →
 * `POST https://<domain>/api/webhooks/inbound-email`
 *
 * Auth: Svix headers with `SUPPORT_INBOUND_EMAIL_WEBHOOK_SECRET` / `RESEND_WEBHOOK_SECRET`
 * (`whsec_…`), or `Authorization: Bearer <same secret>`.
 *
 * Point `SUPPORT_INBOUND_REPLY_TO` at the receiving mailbox and set the Klaviyo
 * flow Reply-To to `{{ event.reply_to }}` (plus-addressed with the case id).
 */
export async function POST(request: Request) {
  const secret = inboundEmailWebhookSecret()
  if (!secret) {
    console.error("[inbound-email] SUPPORT_INBOUND_EMAIL_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("[inbound-email] SUPABASE_SERVICE_ROLE_KEY is not set")
    return NextResponse.json({ error: "Webhook handler not configured" }, { status: 501 })
  }

  const rawBody = await request.text()

  try {
    verifyInboundEmailWebhookAuth({
      rawBody,
      headers: request.headers,
      secret,
    })
  } catch (e) {
    if (e instanceof InboundEmailMissingAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (e instanceof InboundEmailTimestampError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (e instanceof InboundEmailSignatureError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    console.error("[inbound-email] verify:", e)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const envelope = resendWebhookEnvelopeSchema.safeParse(json)
  if (envelope.success && envelope.data.type.startsWith("email.")) {
    if (envelope.data.type !== "email.received") {
      return NextResponse.json({ received: true, skipped: true, reason: envelope.data.type })
    }

    const parsed = resendEmailReceivedSchema.safeParse(json)
    if (!parsed.success) {
      console.warn("[inbound-email] Resend payload validation:", parsed.error.flatten())
      return NextResponse.json({ error: "Invalid inbound payload" }, { status: 400 })
    }

    let email = normalizedInboundFromResend(parsed.data)
    const hydrated = await hydrateInboundEmailFromResend(email)
    if ("error" in hydrated) {
      return NextResponse.json({ error: hydrated.error }, { status: 500 })
    }
    email = hydrated

    const result = await applyInboundSupportEmail(email)
    return inboundResultResponse(result)
  }

  const generic = genericInboundEmailSchema.safeParse(json)
  if (!generic.success) {
    console.warn("[inbound-email] generic payload validation:", generic.error.flatten())
    return NextResponse.json({ error: "Invalid inbound payload" }, { status: 400 })
  }

  const fallbackId = `sha256:${createHash("sha256").update(rawBody).digest("hex")}`
  const email = normalizedInboundFromGeneric(generic.data, fallbackId)
  const result = await applyInboundSupportEmail(email)
  return inboundResultResponse(result)
}

function inboundResultResponse(
  result: Awaited<ReturnType<typeof applyInboundSupportEmail>>,
) {
  if (!result.ok) {
    const status = result.retryable ? 500 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({
    received: true,
    status: result.status,
    caseId: result.caseId ?? null,
    reason: result.reason ?? null,
  })
}

export function GET() {
  return new NextResponse(null, { status: 404 })
}
