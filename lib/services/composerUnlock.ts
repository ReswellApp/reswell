import { createHmac, timingSafeEqual } from "node:crypto"

export const COMPOSER_UNLOCK_TTL_MS = 2 * 60 * 1000
export const COMPOSER_UNLOCK_RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const

export type ComposerUnlockScope = "marketplace" | "live-chat"

export type ComposerUnlockPayload = {
  v: 1
  scope: ComposerUnlockScope
  sub: string
  sessionPublicId: string | null
  iat: number
  exp: number
}

function signingSecret(): string | null {
  const dedicated = process.env.COMPOSER_UNLOCK_SIGNING_SECRET?.trim()
  if (dedicated) return dedicated
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.CRON_SECRET?.trim()
  if (fallback) return fallback
  if (process.env.NODE_ENV !== "production") return "reswell-dev-composer-unlock"
  return null
}

function encodePayload(payload: ComposerUnlockPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decodePayload(encoded: string): ComposerUnlockPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8")
    const parsed = JSON.parse(raw) as ComposerUnlockPayload
    if (
      parsed.v !== 1 ||
      (parsed.scope !== "marketplace" && parsed.scope !== "live-chat") ||
      typeof parsed.sub !== "string" ||
      parsed.sub.length === 0 ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      (parsed.sessionPublicId != null && typeof parsed.sessionPublicId !== "string")
    ) {
      return null
    }
    return {
      v: 1,
      scope: parsed.scope,
      sub: parsed.sub,
      sessionPublicId: parsed.sessionPublicId ?? null,
      iat: parsed.iat,
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

function signBody(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(encoded, "utf8").digest("base64url")
}

export function signComposerUnlockToken(input: {
  scope: ComposerUnlockScope
  sub: string
  sessionPublicId?: string | null
  nowMs?: number
  ttlMs?: number
}): { token: string; expiresAt: number } | null {
  const secret = signingSecret()
  if (!secret) return null

  const nowMs = input.nowMs ?? Date.now()
  const ttlMs = input.ttlMs ?? COMPOSER_UNLOCK_TTL_MS
  const payload: ComposerUnlockPayload = {
    v: 1,
    scope: input.scope,
    sub: input.sub.trim(),
    sessionPublicId: input.sessionPublicId?.trim() || null,
    iat: nowMs,
    exp: nowMs + ttlMs,
  }
  if (!payload.sub) return null

  const encoded = encodePayload(payload)
  return {
    token: `${encoded}.${signBody(encoded, secret)}`,
    expiresAt: payload.exp,
  }
}

export function verifyComposerUnlockToken(
  token: string,
  expected: {
    scope: ComposerUnlockScope
    sub: string
    sessionPublicId?: string | null
  },
): { ok: true; payload: ComposerUnlockPayload } | { ok: false } {
  const secret = signingSecret()
  if (!secret) return { ok: false }

  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0) return { ok: false }

  const encoded = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  const expectedSig = signBody(encoded, secret)
  const sigBuf = Buffer.from(sig, "utf8")
  const expectedBuf = Buffer.from(expectedSig, "utf8")
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false }
  }

  const payload = decodePayload(encoded)
  if (!payload) return { ok: false }
  if (payload.exp < Date.now()) return { ok: false }
  if (payload.scope !== expected.scope) return { ok: false }
  if (payload.sub !== expected.sub.trim()) return { ok: false }
  if (
    payload.sessionPublicId &&
    expected.sessionPublicId &&
    payload.sessionPublicId !== expected.sessionPublicId.trim()
  ) {
    return { ok: false }
  }

  return { ok: true, payload }
}

export function verifyMarketplaceComposerUnlock(
  token: string | null | undefined,
  userId: string,
): boolean {
  if (!token?.trim() || !userId.trim()) return false
  return verifyComposerUnlockToken(token, { scope: "marketplace", sub: userId }).ok
}

export function verifyLiveChatComposerUnlock(
  token: string | null | undefined,
  visitorToken: string,
  sessionPublicId?: string | null,
): boolean {
  if (!token?.trim() || !visitorToken.trim()) return false
  return verifyComposerUnlockToken(token, {
    scope: "live-chat",
    sub: visitorToken,
    sessionPublicId,
  }).ok
}

