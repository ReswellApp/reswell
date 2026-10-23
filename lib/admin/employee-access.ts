/**
 * Employees (`profiles.is_employee`, not `profiles.is_admin`) may open only
 * these admin tools. Admins are unaffected. Enforcement lives in the session
 * proxy, the sidebar, and the client guard so a typed URL cannot slip through.
 */

export const EMPLOYEE_ADMIN_HOME = "/admin/home"

/** Tools an employee can open, in sidebar and home-tile order. */
export const EMPLOYEE_TOOLS = [
  { href: "/admin/home", label: "Home" },
  { href: "/admin/search-analytics", label: "Search analytics" },
  { href: "/admin/saved-searches", label: "Saved searches" },
  { href: "/admin/used-board-market-dashboard?tab=catalog", label: "Brand catalog" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/shipping", label: "Shipping" },
  { href: "/admin/orders/terminal", label: "In-person checkout" },
] as const

/** Sidebar hrefs an employee may see. Query strings are part of the match. */
export const EMPLOYEE_NAV_HREFS = new Set<string>(EMPLOYEE_TOOLS.map((tool) => tool.href))

const EMPLOYEE_PATH_PREFIXES = [
  "/admin/home",
  "/admin/search-analytics",
  "/admin/saved-searches",
  "/admin/crm",
  "/admin/shipping",
  "/admin/orders/terminal",
] as const

export type EmployeeAdminPathDecision =
  | { allow: true }
  | { allow: false; redirectPath: string; redirectSearch: string }

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Decide whether an employee may view this admin URL.
 * The used-board market page is catalog-only; any other tab redirects there.
 */
export function employeeAdminPathDecision(
  pathname: string,
  searchParams: URLSearchParams,
): EmployeeAdminPathDecision {
  if (pathname === "/admin/used-board-market-dashboard") {
    if (searchParams.get("tab") === "catalog") return { allow: true }
    const next = new URLSearchParams(searchParams)
    next.set("tab", "catalog")
    return {
      allow: false,
      redirectPath: pathname,
      redirectSearch: `?${next.toString()}`,
    }
  }

  if (EMPLOYEE_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return { allow: true }
  }

  return { allow: false, redirectPath: EMPLOYEE_ADMIN_HOME, redirectSearch: "" }
}
