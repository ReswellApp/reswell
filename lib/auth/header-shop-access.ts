import { accountRoleHasPermission } from "@/lib/account-access/permissions"
import type {
  HeaderShopAccess,
  HeaderShopAccessOption,
} from "@/lib/auth/header-site-bootstrap"

const LABEL_MAX = 120

export interface HeaderShopAccessLoad {
  ok: true
  access: HeaderShopAccess
}

export interface HeaderShopAccessLoadFailed {
  ok: false
}

function clipLabel(value: string, fallback: string): string {
  const trimmed = value.trim()
  const source = trimmed || fallback
  return source.length > LABEL_MAX ? source.slice(0, LABEL_MAX) : source
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function profileLabel(row: {
  shop_name?: unknown
  display_name?: unknown
  email?: unknown
} | null): string {
  if (!row) return "Shop"
  return clipLabel(
    readString(row.shop_name) ?? readString(row.display_name) ?? readString(row.email) ?? "",
    "Shop",
  )
}

function cleanEmail(email: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.length > 320 ? trimmed.slice(0, 320) : trimmed
}

function readRole(value: unknown): "manager" | "staff" | null {
  return value === "manager" || value === "staff" ? value : null
}

interface MembershipInput {
  accountId: string
  role: "manager" | "staff"
  label: string
  /** Linked Shopify store — drives nav, not the old approval flag. */
  shopifyConnectEnabled: boolean
}

/**
 * Personal login plus every accepted shop. An active shop id that is no longer
 * a membership falls back to the personal account.
 */
export function buildHeaderShopAccess(input: {
  userId: string
  email: string | null
  actorLabel: string
  activeShopAccountId: string | null
  /** True when the personal account has a linked Shopify store. */
  actorShopifyConnectEnabled: boolean
  memberships: MembershipInput[]
}): HeaderShopAccess {
  const seen = new Set<string>()
  const shops: MembershipInput[] = []
  for (const membership of input.memberships) {
    if (!membership.accountId || membership.accountId === input.userId) continue
    if (seen.has(membership.accountId)) continue
    seen.add(membership.accountId)
    shops.push(membership)
  }

  const activeMembership =
    input.activeShopAccountId && input.activeShopAccountId !== input.userId
      ? shops.find((row) => row.accountId === input.activeShopAccountId) ?? null
      : null

  const activeAccountId = activeMembership ? activeMembership.accountId : input.userId
  const role = activeMembership ? activeMembership.role : "owner"
  const actingAsShop = activeAccountId !== input.userId

  const personal: HeaderShopAccessOption = {
    accountId: input.userId,
    label: "My account",
    role: "owner",
    shopifyConnectEnabled: input.actorShopifyConnectEnabled,
  }
  const listed = shops.slice(0, 39)
  if (
    activeMembership &&
    !listed.some((row) => row.accountId === activeMembership.accountId)
  ) {
    listed.splice(38, listed.length, activeMembership)
  }
  const options: HeaderShopAccessOption[] = [
    personal,
    ...listed.map((row) => ({
      accountId: row.accountId,
      label: clipLabel(row.label, "Shop"),
      role: row.role,
      shopifyConnectEnabled: row.shopifyConnectEnabled,
    })),
  ]
  const active = options.find((row) => row.accountId === activeAccountId) ?? personal

  return {
    actorUserId: input.userId,
    activeAccountId: active.accountId,
    actingAsShop,
    shopLabel: actingAsShop ? active.label : clipLabel(input.actorLabel, "My account"),
    role: active.role,
    actorEmail: cleanEmail(input.email),
    showEarnings: accountRoleHasPermission(role, "payouts.read"),
    hasShopifyAccess: active.shopifyConnectEnabled === true,
    options,
  }
}

/** Point the open menu at another account before the header refetch returns. */
export function headerShopAccessWithActiveAccount(
  access: HeaderShopAccess,
  accountId: string | null,
): HeaderShopAccess {
  const nextId = !accountId || accountId === access.actorUserId ? access.actorUserId : accountId
  const option = access.options.find((row) => row.accountId === nextId)
  if (!option) return access
  const actingAsShop = option.accountId !== access.actorUserId
  return {
    ...access,
    activeAccountId: option.accountId,
    actingAsShop,
    role: option.role,
    shopLabel: actingAsShop ? option.label : access.shopLabel,
    showEarnings: accountRoleHasPermission(option.role, "payouts.read"),
    hasShopifyAccess:
      typeof option.shopifyConnectEnabled === "boolean"
        ? option.shopifyConnectEnabled
        : access.hasShopifyAccess,
  }
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
}

/** Map profile and membership rows into the menu's account list. */
export function headerShopAccessFromRows(input: {
  userId: string
  email: string | null
  actor: Record<string, unknown> | null
  memberships: unknown
  profiles: unknown
  /** Account ids with a claimed App Store Shopify link. */
  linkedShopifyAccountIds?: ReadonlySet<string>
}): HeaderShopAccess {
  const linked = input.linkedShopifyAccountIds ?? new Set<string>()
  const labels = new Map<string, string>()
  for (const row of asRows(input.profiles)) {
    const id = readString(row.id)
    if (!id) continue
    labels.set(id, profileLabel(row))
  }

  const memberships: MembershipInput[] = []
  for (const row of asRows(input.memberships)) {
    const accountId = readString(row.account_id)
    const role = readRole(row.role)
    if (!accountId || !role) continue
    memberships.push({
      accountId,
      role,
      label: labels.get(accountId) ?? "Shop",
      shopifyConnectEnabled: linked.has(accountId),
    })
  }

  return buildHeaderShopAccess({
    userId: input.userId,
    email: input.email,
    actorLabel: readString(input.actor?.display_name) ?? "Personal",
    activeShopAccountId: readString(input.actor?.active_shop_account_id ?? null),
    actorShopifyConnectEnabled: linked.has(input.userId),
    memberships,
  })
}

