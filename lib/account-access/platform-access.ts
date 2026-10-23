/**
 * Reswell admin and employee dashboards follow the signed-in user's own
 * profile flags. Membership on a shop — including a shop whose owner is the
 * platform admin — never grants either flag.
 */
export function platformAccessForSignedInUser(input: {
  profile: { is_admin?: boolean | null; is_employee?: boolean | null } | null
  shopAccountIsAdmin?: boolean
  shopAccountIsEmployee?: boolean
}): { isAdmin: boolean; isEmployee: boolean } {
  // Shop-account flags are accepted so call sites cannot confuse them with access.
  // They do not change the result.
  void input.shopAccountIsAdmin
  void input.shopAccountIsEmployee
  return {
    isAdmin: input.profile?.is_admin === true,
    isEmployee: input.profile?.is_employee === true,
  }
}
