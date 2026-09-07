import "server-only"

import { cookies } from "next/headers"
import {
  AD_ATTR_COOKIE,
  parseAdAttributionCookie,
  type AdAttributionSnapshot,
} from "@/lib/ads/attribution"

export async function readAdAttributionFromCookies(): Promise<AdAttributionSnapshot | null> {
  try {
    const store = await cookies()
    return parseAdAttributionCookie(store.get(AD_ATTR_COOKIE)?.value)
  } catch {
    return null
  }
}
