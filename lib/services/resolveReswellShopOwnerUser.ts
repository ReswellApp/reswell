import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const uuidSchema = z.string().uuid()

/** Canonical platform inbox for Reswell-owned retail inventory (`section = new`). */
export const DEFAULT_RESWELL_SHOP_OWNER_EMAIL = "shop@reswell.app"

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Env UUID for the Reswell shop owner profile, when set.
 * Sync helper for redirects / comparisons without a DB round-trip.
 */
export function configuredReswellShopOwnerUserId(): string | null {
  const byIdRaw = process.env.RESWELL_SHOP_OWNER_USER_ID?.trim()
  if (!byIdRaw) return null
  const parsed = uuidSchema.safeParse(byIdRaw)
  return parsed.success ? parsed.data : null
}

/**
 * Resolves the dedicated Reswell shop owner profile.
 * Prefer `RESWELL_SHOP_OWNER_USER_ID`, else email (`RESWELL_SHOP_OWNER_EMAIL` or shop@reswell.app).
 */
export async function resolveReswellShopOwnerUserId(
  serviceSupabase: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const configuredId = configuredReswellShopOwnerUserId()
  if (configuredId) {
    const { data, error } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", configuredId)
      .maybeSingle()
    if (error || !data?.id) {
      return {
        ok: false,
        error:
          "RESWELL_SHOP_OWNER_USER_ID is set but no matching profile exists. Create the platform shop account or fix the env value.",
      }
    }
    return { ok: true, userId: data.id }
  }

  const byEmailRaw =
    process.env.RESWELL_SHOP_OWNER_EMAIL?.trim() || DEFAULT_RESWELL_SHOP_OWNER_EMAIL
  const email = normalizeEmail(byEmailRaw)
  if (!z.string().email().safeParse(email).success) {
    return {
      ok: false,
      error: "RESWELL_SHOP_OWNER_EMAIL is invalid. See .env.example.",
    }
  }

  const { data, error } = await serviceSupabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (error || !data?.id) {
    return {
      ok: false,
      error: `Reswell shop owner profile not found for ${email}. Run: npx tsx scripts/ensure-reswell-shop-owner.ts`,
    }
  }

  return { ok: true, userId: data.id }
}
