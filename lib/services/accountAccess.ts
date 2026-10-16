import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { conversationViewerIdentity, type ConversationViewerIdentity } from "@/lib/account-access/conversation-viewer"
import {
  canGrantAccountRole,
  normalizeAccountEmail,
  permissionsForAccountRole,
  type AccountPermission,
  type AccountRole,
} from "@/lib/account-access/permissions"
import { platformAccessForSignedInUser } from "@/lib/account-access/platform-access"
import {
  listActiveMembershipsForUser,
  listLiveAccountMembers,
  listPendingInvitesForEmail,
  type AccountMemberRow,
} from "@/lib/db/account-members"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { InviteAccountMemberInput } from "@/lib/validations/account-members"

export interface ShopAccountOption {
  accountId: string
  label: string
  role: AccountRole
}

export interface ShopAccountContext {
  actorUserId: string
  actorEmail: string | null
  accountId: string
  role: AccountRole
  permissions: ReadonlySet<AccountPermission>
  actingAsShop: boolean
  shopLabel: string
  accountIsPlatformAdmin: boolean
  platformAdmin: boolean
  platformEmployee: boolean
  isShop: boolean
  sellerSlug: string | null
  shopifyConnectEnabled: boolean
  options: ShopAccountOption[]
  pendingInvites: AccountMemberRow[]
}

interface ProfileAccessRow {
  id: string
  email: string | null
  is_admin: boolean | null
  is_employee: boolean | null
  is_shop: boolean | null
  active_shop_account_id: string | null
  display_name: string | null
  shop_name: string | null
  seller_slug: string | null
  shopify_connect_enabled: boolean | null
}

const PROFILE_ACCESS_COLUMNS =
  "id, email, is_admin, is_employee, is_shop, active_shop_account_id, display_name, shop_name, seller_slug, shopify_connect_enabled"

function profileLabel(row: {
  shop_name?: string | null
  display_name?: string | null
  email?: string | null
}): string {
  const shop = row.shop_name?.trim()
  if (shop) return shop
  const name = row.display_name?.trim()
  if (name) return name
  const email = row.email?.trim()
  if (email) return email
  return "Shop"
}

const PROFILE_ACCESS_COLUMNS_WITHOUT_SHOP =
  "id, email, is_admin, is_employee, is_shop, display_name, shop_name, seller_slug, shopify_connect_enabled"

async function loadActorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileAccessRow | null> {
  const primary = await supabase
    .from("profiles")
    .select(PROFILE_ACCESS_COLUMNS)
    .eq("id", userId)
    .maybeSingle()
  if (!primary.error) return (primary.data ?? null) as ProfileAccessRow | null

  console.error("[account-access] actor profile failed", {
    userId,
    message: primary.error.message,
    timestamp: new Date().toISOString(),
  })

  const fallback = await supabase
    .from("profiles")
    .select(PROFILE_ACCESS_COLUMNS_WITHOUT_SHOP)
    .eq("id", userId)
    .maybeSingle()
  if (fallback.error || !fallback.data) {
    if (fallback.error) {
      console.error("[account-access] actor profile fallback failed", {
        userId,
        message: fallback.error.message,
        timestamp: new Date().toISOString(),
      })
    }
    return null
  }

  return {
    ...(fallback.data as Omit<ProfileAccessRow, "active_shop_account_id">),
    active_shop_account_id: null,
  }
}

async function linkInvitesToUser(userId: string, email: string): Promise<void> {
  try {
    const admin = createServiceRoleClient()
    const { error } = await admin
      .from("account_members")
      .update({ member_user_id: userId })
      .eq("email", email)
      .eq("status", "invited")
      .is("member_user_id", null)
    if (error) {
      console.error("[account-access] link invites failed", {
        userId,
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("[account-access] link invites skipped", {
      userId,
      message: error instanceof Error ? error.message : "unknown",
      timestamp: new Date().toISOString(),
    })
  }
}

export const getShopAccountContext = cache(async (): Promise<ShopAccountContext | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const actorEmail = user.email ? normalizeAccountEmail(user.email) : null
  if (actorEmail) {
    await linkInvitesToUser(user.id, actorEmail)
  }

  const [actor, memberships, pendingInvites] = await Promise.all([
    loadActorProfile(supabase, user.id),
    listActiveMembershipsForUser(supabase, user.id),
    actorEmail ? listPendingInvitesForEmail(supabase, actorEmail) : Promise.resolve([]),
  ])
  const requestedShopId = actor?.active_shop_account_id ?? null
  const activeMembership =
    requestedShopId && requestedShopId !== user.id
      ? memberships.find((row) => row.account_id === requestedShopId) ?? null
      : null

  const accountId = activeMembership ? activeMembership.account_id : user.id
  const role: AccountRole = activeMembership ? activeMembership.role : "owner"
  const actingAsShop = accountId !== user.id

  let accountProfile = actor
  if (actingAsShop) {
    const { data: shopRow } = await supabase
      .from("profiles")
      .select(PROFILE_ACCESS_COLUMNS)
      .eq("id", accountId)
      .maybeSingle()
    accountProfile = (shopRow as ProfileAccessRow | null) ?? actor
  }

  const accountIds = [user.id, ...memberships.map((row) => row.account_id)]
  const { data: optionRows } = await supabase
    .from("profiles")
    .select("id, shop_name, display_name, email")
    .in("id", accountIds)

  const labelById = new Map<string, string>()
  for (const row of optionRows ?? []) {
    const id = typeof row.id === "string" ? row.id : ""
    if (!id) continue
    labelById.set(
      id,
      profileLabel(row as { shop_name?: string | null; display_name?: string | null; email?: string | null }),
    )
  }

  const options: ShopAccountOption[] = [
    { accountId: user.id, label: "My account", role: "owner" },
    ...memberships.map((row) => ({
      accountId: row.account_id,
      label: labelById.get(row.account_id) ?? "Shop",
      role: row.role,
    })),
  ]

  const platform = platformAccessForSignedInUser({
    profile: actor,
    shopAccountIsAdmin: accountProfile?.is_admin === true,
    shopAccountIsEmployee: accountProfile?.is_employee === true,
  })

  return {
    actorUserId: user.id,
    actorEmail,
    accountId,
    role,
    permissions: permissionsForAccountRole(role),
    actingAsShop,
    shopLabel: actingAsShop ? (labelById.get(accountId) ?? "Shop") : profileLabel(actor ?? {}),
    accountIsPlatformAdmin: accountProfile?.is_admin === true,
    platformAdmin: platform.isAdmin,
    platformEmployee: platform.isEmployee,
    isShop: accountProfile?.is_shop === true,
    sellerSlug: accountProfile?.seller_slug ?? null,
    shopifyConnectEnabled: accountProfile?.shopify_connect_enabled === true,
    options,
    pendingInvites,
  }
})

export async function viewerForConversation(
  actorUserId: string,
  buyerId: string,
  sellerId: string,
): Promise<ConversationViewerIdentity> {
  const shop = await getShopAccountContext()
  return conversationViewerIdentity({
    actorUserId,
    buyerId,
    sellerId,
    shopAccountId: shop?.accountId ?? actorUserId,
    canReadMessages: shop?.permissions.has("messages.read") ?? false,
    canWriteMessages: shop?.permissions.has("messages.write") ?? false,
  })
}

async function accountOwnerEmail(supabase: SupabaseClient, accountId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("email").eq("id", accountId).maybeSingle()
  const email = typeof data?.email === "string" ? data.email : null
  return email ? normalizeAccountEmail(email) : null
}

export async function inviteAccountMember(
  input: InviteAccountMemberInput,
): Promise<{ success: true } | { error: string }> {
  const shop = await getShopAccountContext()
  if (!shop) return { error: "Sign in to add someone to this account." }
  if (!canGrantAccountRole(shop.role, input.role)) {
    return { error: "You can't grant that access on this account." }
  }

  const email = normalizeAccountEmail(input.email)
  const ownerEmail = await accountOwnerEmail(await createClient(), shop.accountId)
  if (ownerEmail && email === ownerEmail) {
    return { error: "That email already signs in as the account owner." }
  }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: "Account invites are unavailable right now." }
  }

  const { data: existing, error: existingError } = await admin
    .from("account_members")
    .select("id, status, role")
    .eq("account_id", shop.accountId)
    .eq("email", email)
    .in("status", ["invited", "active"])
    .maybeSingle()

  if (existingError) {
    console.error("[account-access] invite lookup failed", {
      accountId: shop.accountId,
      message: existingError.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not add that email." }
  }
  if (existing) {
    return { error: "That email already has access to this account." }
  }

  const { data: profileMatch } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle()
  const memberUserId = typeof profileMatch?.id === "string" ? profileMatch.id : null
  if (memberUserId === shop.accountId) {
    return { error: "That email already signs in as the account owner." }
  }

  const { data: revokedRows } = await admin
    .from("account_members")
    .select("id")
    .eq("account_id", shop.accountId)
    .eq("email", email)
    .eq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
  const revoked = revokedRows?.[0]

  const nextRow = {
    email,
    role: input.role,
    status: "invited" as const,
    member_user_id: memberUserId,
    invited_by: shop.actorUserId,
    accepted_at: null,
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }

  if (revoked?.id) {
    const { error } = await admin.from("account_members").update(nextRow).eq("id", revoked.id)
    if (error) {
      console.error("[account-access] reinvite failed", {
        accountId: shop.accountId,
        message: error.message,
        timestamp: new Date().toISOString(),
      })
      return { error: "Could not add that email." }
    }
    return { success: true }
  }

  const { error: insertError } = await admin.from("account_members").insert({
    account_id: shop.accountId,
    ...nextRow,
  })
  if (insertError) {
    console.error("[account-access] invite insert failed", {
      accountId: shop.accountId,
      message: insertError.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not add that email." }
  }
  return { success: true }
}

export async function listAccountTeam(): Promise<AccountMemberRow[]> {
  const shop = await getShopAccountContext()
  if (!shop || !shop.permissions.has("team.read")) return []
  const supabase = await createClient()
  return listLiveAccountMembers(supabase, shop.accountId)
}

export async function revokeAccountMember(
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const shop = await getShopAccountContext()
  if (!shop) return { error: "Sign in to manage this account." }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: "Account access is unavailable right now." }
  }

  const { data: member, error } = await admin
    .from("account_members")
    .select("id, account_id, member_user_id, role, status")
    .eq("id", memberId)
    .maybeSingle()

  if (error || !member) return { error: "That person is not on this account." }
  if (member.account_id !== shop.accountId) return { error: "That person is not on this account." }
  if (member.status === "revoked") return { success: true }
  if (member.role !== "manager" && member.role !== "staff") {
    return { error: "That access can't be removed from here." }
  }
  if (!canGrantAccountRole(shop.role, member.role)) {
    return { error: "You can't remove that access." }
  }

  const { error: updateError } = await admin
    .from("account_members")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)

  if (updateError) {
    console.error("[account-access] revoke failed", {
      memberId,
      message: updateError.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not remove that access." }
  }

  if (typeof member.member_user_id === "string") {
    await admin
      .from("profiles")
      .update({ active_shop_account_id: null })
      .eq("id", member.member_user_id)
      .eq("active_shop_account_id", shop.accountId)
  }

  return { success: true }
}

async function inviteForActor(memberId: string): Promise<
  | { error: string }
  | { admin: SupabaseClient; shop: ShopAccountContext; email: string }
> {
  const shop = await getShopAccountContext()
  if (!shop?.actorEmail) return { error: "Sign in with the invited email to respond." }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: "Account invites are unavailable right now." }
  }

  const { data: invite, error } = await admin
    .from("account_members")
    .select("id, email, status, account_id")
    .eq("id", memberId)
    .maybeSingle()

  if (error || !invite || invite.status !== "invited") {
    return { error: "That invite is no longer open." }
  }
  if (normalizeAccountEmail(String(invite.email ?? "")) !== shop.actorEmail) {
    return { error: "Sign in with the invited email to respond." }
  }
  return { admin, shop, email: shop.actorEmail }
}

export async function acceptAccountInvite(
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const resolved = await inviteForActor(memberId)
  if ("error" in resolved) return resolved

  const { data: invite, error: readError } = await resolved.admin
    .from("account_members")
    .select("account_id")
    .eq("id", memberId)
    .maybeSingle()
  const accountId = typeof invite?.account_id === "string" ? invite.account_id : null
  if (readError || !accountId) return { error: "That invite is no longer open." }

  const { error } = await resolved.admin
    .from("account_members")
    .update({
      status: "active",
      member_user_id: resolved.shop.actorUserId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("status", "invited")

  if (error) {
    console.error("[account-access] accept failed", {
      memberId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not accept that invite." }
  }

  const { data: actor } = await resolved.admin
    .from("profiles")
    .select("active_shop_account_id")
    .eq("id", resolved.shop.actorUserId)
    .maybeSingle()

  if (!actor?.active_shop_account_id) {
    await resolved.admin
      .from("profiles")
      .update({ active_shop_account_id: accountId })
      .eq("id", resolved.shop.actorUserId)
  }

  return { success: true }
}

export async function declineAccountInvite(
  memberId: string,
): Promise<{ success: true } | { error: string }> {
  const resolved = await inviteForActor(memberId)
  if ("error" in resolved) return resolved

  const { error } = await resolved.admin
    .from("account_members")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("status", "invited")

  if (error) return { error: "Could not decline that invite." }
  return { success: true }
}

export async function setActiveShopAccount(
  accountId: string | null,
): Promise<{ success: true } | { error: string }> {
  const shop = await getShopAccountContext()
  if (!shop) return { error: "Sign in to switch accounts." }

  const nextId = !accountId || accountId === shop.actorUserId ? null : accountId
  if (nextId) {
    const allowed = shop.options.some((option) => option.accountId === nextId && option.role !== "owner")
    const ownsIt = nextId === shop.actorUserId
    if (!allowed && !ownsIt) return { error: "You don't have access to that account." }
  }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: "Switching accounts is unavailable right now." }
  }

  const { error } = await admin
    .from("profiles")
    .update({ active_shop_account_id: nextId })
    .eq("id", shop.actorUserId)

  if (error) {
    console.error("[account-access] switch failed", {
      userId: shop.actorUserId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not switch accounts." }
  }
  return { success: true }
}

export async function assertAccountPermission(
  permission: AccountPermission,
): Promise<{ shop: ShopAccountContext } | { error: string }> {
  const shop = await getShopAccountContext()
  if (!shop) return { error: "Sign in to continue." }
  if (!shop.permissions.has(permission)) return { error: "You don't have access to that." }
  return { shop }
}
