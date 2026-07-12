/**
 * Server-only: extracts Meta match signals from the current request — the `_fbp` / `_fbc`
 * cookies the pixel sets, plus client IP and user-agent. These raise Conversions API match
 * quality. Best-effort: returns empty fields when called outside a request scope (e.g. a
 * background webhook with no buyer browser context).
 */

import "server-only"

import type { MetaUserData } from "@/lib/meta/conversions-api"
import {
  resolveMetaBrowserSignals,
  type MetaBrowserSignalsOverride,
} from "@/lib/meta/resolve-browser-signals"

export type MetaBrowserSignals = Pick<
  MetaUserData,
  "fbp" | "fbc" | "clientIpAddress" | "clientUserAgent"
>

export async function getMetaBrowserSignals(
  override?: MetaBrowserSignalsOverride,
): Promise<MetaBrowserSignals> {
  try {
    return await resolveMetaBrowserSignals(override)
  } catch {
    return {}
  }
}
