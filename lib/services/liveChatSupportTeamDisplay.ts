import { LIVE_CHAT_SUPPORT_LEAD_FALLBACK } from "@/lib/live-chat/support-lead-display"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"

export type LiveChatSupportTeamMember = {
  id: string
  name: string
  imageUrl: string
  initials: string
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "RW"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
}

function toTeamMember(row: {
  id: string
  display_name: string | null
  shop_name: string | null
  is_shop: boolean | null
  shop_logo_url: string | null
  avatar_url: string | null
}): LiveChatSupportTeamMember {
  const name =
    (row.is_shop && row.shop_name?.trim()) ||
    row.display_name?.trim() ||
    "Reswell Support"
  const imageUrl = resolveSellerProfileDisplayImageUrl(row) || ""
  return {
    id: row.id,
    name,
    imageUrl,
    initials: initialsFromName(name),
  }
}

/** Public-facing support faces for the live chat waiting banner — Hayden first. */
export async function getLiveChatSupportTeamDisplayService(): Promise<LiveChatSupportTeamMember[]> {
  try {
    const svc = createServiceRoleClient()
    const resolved = await resolveSupportRecipientUserId()
    const primaryId = resolved.ok ? resolved.userId : null

    const { data: staffRows, error } = await svc
      .from("profiles")
      .select("id, display_name, shop_name, is_shop, shop_logo_url, avatar_url, is_admin, is_employee")
      .or("is_admin.eq.true,is_employee.eq.true")
      .limit(12)

    if (error || !staffRows?.length) {
      return [LIVE_CHAT_SUPPORT_LEAD_FALLBACK]
    }

    const members = staffRows.map((row) =>
      toTeamMember(row as Parameters<typeof toTeamMember>[0]),
    )

    const withImages = members.filter((m) => m.imageUrl.length > 0)
    const pool = withImages.length > 0 ? withImages : members

    if (primaryId) {
      const primary = pool.find((m) => m.id === primaryId)
      if (primary) {
        return [primary]
      }
    }

    const haydenLike =
      pool.find((m) => m.name.toLowerCase().includes("hayden")) ??
      pool.find((m) => m.initials === "HG")

    if (haydenLike) {
      return [haydenLike]
    }

    return pool.slice(0, 1)
  } catch {
    return [LIVE_CHAT_SUPPORT_LEAD_FALLBACK]
  }
}
