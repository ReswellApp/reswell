/**
 * Server-only: resolves validated Meta `fbc` / `fbp` via Facebook's Parameter Builder.
 *
 * Client-provided values (from `meta-capi-param-builder-clientjs`) take precedence over raw
 * request cookies so CAPI events match what the browser pixel sends.
 */

import "server-only"

import { ParamBuilder } from "capi-param-builder-nodejs"
import { cookies, headers } from "next/headers"

import { META_PARAM_BUILDER_DOMAINS } from "@/lib/meta/param-builder-domains"
import type { MetaBrowserSignals } from "@/lib/meta/server-event-context"

export type MetaBrowserSignalsOverride = {
  fbc?: string | null
  fbp?: string | null
}

function firstForwardedIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null
  const first = forwardedFor.split(",")[0]?.trim()
  return first || null
}

function parseFbclidFromUrl(url: string | null): string | null {
  if (!url?.trim()) return null
  try {
    const value = new URL(url).searchParams.get("fbclid")
    return value?.trim() || null
  } catch {
    return null
  }
}

export async function resolveMetaBrowserSignals(
  override?: MetaBrowserSignalsOverride,
): Promise<MetaBrowserSignals> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

  const cookieMap: Record<string, string> = {}
  const rawFbc = cookieStore.get("_fbc")?.value
  const rawFbp = cookieStore.get("_fbp")?.value
  if (rawFbc?.trim()) cookieMap._fbc = rawFbc.trim()
  if (rawFbp?.trim()) cookieMap._fbp = rawFbp.trim()

  const clientFbc = override?.fbc?.trim()
  const clientFbp = override?.fbp?.trim()
  if (clientFbc) cookieMap._fbc = clientFbc
  if (clientFbp) cookieMap._fbp = clientFbp

  const host = headerStore.get("host")?.trim() || "www.reswell.app"
  const referer = headerStore.get("referer")
  const queries: Record<string, string> = {}
  const fbclid = parseFbclidFromUrl(referer)
  if (fbclid) queries.fbclid = fbclid

  const builder = new ParamBuilder([...META_PARAM_BUILDER_DOMAINS])
  builder.processRequest(host, queries, cookieMap, referer)

  const fbc = builder.getFbc()
  const fbp = builder.getFbp()
  const clientUserAgent = headerStore.get("user-agent")
  const clientIpAddress =
    firstForwardedIp(headerStore.get("x-forwarded-for")) ??
    headerStore.get("x-real-ip") ??
    null

  return {
    fbc: fbc?.trim() || null,
    fbp: fbp?.trim() || null,
    clientIpAddress,
    clientUserAgent,
  }
}
