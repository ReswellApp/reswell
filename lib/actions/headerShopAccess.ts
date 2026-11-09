"use server"

import { createClient } from "@/lib/supabase/server"
import {
  headerShopAccessFromRows,
  type HeaderShopAccessLoad,
  type HeaderShopAccessLoadFailed,
} from "@/lib/auth/header-shop-access"
import { accountIdsWithShopifyNavLink } from "@/lib/services/shopifyNavAccess"

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
  )
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Header account list + Shopify nav flags. Server-only so shopify_connections
 * (service role) never enters the client bundle via header.tsx.
 */
export async function loadHeaderShopAccessAction(
  userId: string,
  email: string | null,
): Promise<HeaderShopAccessLoad | HeaderShopAccessLoadFailed> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return { ok: false }

  const [actorRes, memberRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("active_shop_account_id, shop_name, display_name, email")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("account_members")
      .select("account_id, role")
      .eq("member_user_id", userId)
      .eq("status", "active"),
  ])

  if (actorRes.error || memberRes.error) {
    console.warn(
      "[header] shop access failed",
      actorRes.error?.message ?? memberRes.error?.message ?? "unknown",
    )
    return { ok: false }
  }

  const membershipRows = asRows(memberRes.data)
  const accountIds = [
    ...new Set(
      membershipRows
        .map((row) => readString(row.account_id))
        .filter((id): id is string => Boolean(id && id !== userId)),
    ),
  ]

  let profiles: unknown = []
  if (accountIds.length > 0) {
    const labelRes = await supabase
      .from("profiles")
      .select("id, shop_name, display_name, email")
      .in("id", accountIds)
    if (labelRes.error) {
      console.warn("[header] shop labels failed", labelRes.error.message)
    } else {
      profiles = labelRes.data ?? []
    }
  }

  const actor =
    actorRes.data && typeof actorRes.data === "object"
      ? (actorRes.data as Record<string, unknown>)
      : null

  const linkedShopifyAccountIds = await accountIdsWithShopifyNavLink([
    userId,
    ...accountIds,
  ])

  return {
    ok: true,
    access: headerShopAccessFromRows({
      userId,
      email,
      actor,
      memberships: memberRes.data,
      profiles,
      linkedShopifyAccountIds,
    }),
  }
}
