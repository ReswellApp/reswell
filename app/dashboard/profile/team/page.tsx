import { AccountTeamPanel } from "@/components/features/dashboard/account-team-panel"
import { canGrantAccountRole } from "@/lib/account-access/permissions"
import { getShopAccountContext, listAccountTeam } from "@/lib/services/accountAccess"
import { createClient } from "@/lib/supabase/server"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Team — Reswell",
  description: "Add emails that can sign in and help run your shop.",
  path: "/dashboard/profile/team",
})

export default async function DashboardProfileTeamPage() {
  const shop = await getShopAccountContext()
  if (!shop) return null

  const [members, inviteLabels] = await Promise.all([
    listAccountTeam(),
    loadInviteLabels(shop.pendingInvites.map((invite) => invite.account_id)),
  ])

  return (
    <AccountTeamPanel
      canManage={shop.permissions.has("team.manage")}
      canInviteManager={shop.role === "owner"}
      members={members.map((member) => ({
        id: member.id,
        email: member.email,
        role: member.role,
        status: member.status === "active" ? "active" : "invited",
        canRevoke: canGrantAccountRole(shop.role, member.role),
      }))}
      pendingInvites={shop.pendingInvites.map((invite) => ({
        id: invite.id,
        shopLabel: inviteLabels.get(invite.account_id) ?? "Shop",
        role: invite.role,
      }))}
      actingAsShop={shop.actingAsShop}
      shopLabel={shop.shopLabel}
      actorEmail={shop.actorEmail}
      showShopAdminWarning={
        shop.actingAsShop &&
        shop.accountIsPlatformAdmin &&
        !shop.platformAdmin &&
        !shop.platformEmployee
      }
    />
  )
}

async function loadInviteLabels(accountIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (accountIds.length === 0) return labels
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, shop_name, display_name")
    .in("id", accountIds)
  for (const row of data ?? []) {
    const id = typeof row.id === "string" ? row.id : ""
    if (!id) continue
    const shopName = typeof row.shop_name === "string" ? row.shop_name.trim() : ""
    const displayName = typeof row.display_name === "string" ? row.display_name.trim() : ""
    labels.set(id, shopName || displayName || "Shop")
  }
  return labels
}
