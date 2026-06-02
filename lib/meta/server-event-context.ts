/**
 * Server-only: extracts Meta match signals from the current request — the `_fbp` / `_fbc`
 * cookies the pixel sets, plus client IP and user-agent. These raise Conversions API match
 * quality. Best-effort: returns empty fields when called outside a request scope (e.g. a
 * background webhook with no buyer browser context).
 */

import "server-only"

import { cookies, headers } from "next/headers"

import type { MetaUserData } from "@/lib/meta/conversions-api"

export type MetaBrowserSignals = Pick<
  MetaUserData,
  "fbp" | "fbc" | "clientIpAddress" | "clientUserAgent"
>

function firstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null
  const first = forwardedFor.split(",")[0]?.trim()
  return first || null
}

export async function getMetaBrowserSignals(): Promise<MetaBrowserSignals> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

    const fbp = cookieStore.get("_fbp")?.value ?? null
    const fbc = cookieStore.get("_fbc")?.value ?? null
    const clientUserAgent = headerStore.get("user-agent")
    const clientIpAddress =
      firstForwardedIp(headerStore.get("x-forwarded-for")) ??
      headerStore.get("x-real-ip") ??
      null

    return { fbp, fbc, clientIpAddress, clientUserAgent }
  } catch {
    return {}
  }
}
