import { NextRequest, NextResponse } from "next/server"
import { assertHumanRequest } from "@/lib/services/botProtection"
import {
  COMPOSER_UNLOCK_RATE_LIMIT,
  signComposerUnlockToken,
} from "@/lib/services/composerUnlock"
import { composerUnlockRequestSchema } from "@/lib/validations/composer-unlock"
import { createClient } from "@/lib/supabase/server"
import {
  consumeLiveChatRateLimit,
  liveChatClientIp,
  liveChatRateLimitResponse,
} from "@/lib/live-chat/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const human = await assertHumanRequest()
    if (!human.ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const limit = consumeLiveChatRateLimit(
      `unlock:${liveChatClientIp(req)}`,
      COMPOSER_UNLOCK_RATE_LIMIT.limit,
      COMPOSER_UNLOCK_RATE_LIMIT.windowMs,
    )
    if (!limit.ok) return liveChatRateLimitResponse(limit.retryAfterSec)

    const parsed = composerUnlockRequestSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    if (parsed.data.scope === "marketplace") {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const issued = signComposerUnlockToken({
        scope: "marketplace",
        sub: user.id,
      })
      if (!issued) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
      return NextResponse.json(
        { data: { token: issued.token, expires_at: issued.expiresAt } },
        { status: 200 },
      )
    }

    const issued = signComposerUnlockToken({
      scope: "live-chat",
      sub: parsed.data.visitor_token,
      sessionPublicId: parsed.data.public_id,
    })
    if (!issued) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    return NextResponse.json(
      { data: { token: issued.token, expires_at: issued.expiresAt } },
      { status: 200 },
    )
  } catch (error) {
    console.error("POST /api/composer-unlock", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
