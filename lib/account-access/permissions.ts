/**
 * Shop-account roles. Any seller account can grant these.
 * Platform admin (`profiles.is_admin` / `is_employee`) is not a role here.
 */

export const ACCOUNT_ROLES = ["owner", "manager", "staff"] as const

export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export const GRANTABLE_ACCOUNT_ROLES = ["manager", "staff"] as const

export type GrantableAccountRole = (typeof GRANTABLE_ACCOUNT_ROLES)[number]

export const ACCOUNT_PERMISSIONS = [
  "listings.read",
  "listings.write",
  "orders.read",
  "orders.write",
  "offers.read",
  "offers.write",
  "messages.read",
  "messages.write",
  "team.read",
  "team.manage",
  "payouts.read",
  "profile.manage",
] as const

export type AccountPermission = (typeof ACCOUNT_PERMISSIONS)[number]

const STAFF_PERMISSIONS = new Set<AccountPermission>([
  "listings.read",
  "listings.write",
  "orders.read",
  "orders.write",
  "offers.read",
  "offers.write",
  "messages.read",
  "messages.write",
])

const MANAGER_EXCLUDED = new Set<AccountPermission>(["payouts.read"])

export function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value)
}

export function isGrantableAccountRole(value: string): value is GrantableAccountRole {
  return (GRANTABLE_ACCOUNT_ROLES as readonly string[]).includes(value)
}

export function permissionsForAccountRole(role: AccountRole): ReadonlySet<AccountPermission> {
  if (role === "owner") return new Set(ACCOUNT_PERMISSIONS)
  if (role === "manager") {
    return new Set(ACCOUNT_PERMISSIONS.filter((permission) => !MANAGER_EXCLUDED.has(permission)))
  }
  return new Set(STAFF_PERMISSIONS)
}

export function accountRoleHasPermission(role: AccountRole, permission: AccountPermission): boolean {
  return permissionsForAccountRole(role).has(permission)
}

/** Managers can add and remove staff. Only the owner can add or remove managers. */
export function canGrantAccountRole(
  actorRole: AccountRole,
  targetRole: GrantableAccountRole,
): boolean {
  if (actorRole === "owner") return true
  if (actorRole === "manager") return targetRole === "staff"
  return false
}

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase()
}
