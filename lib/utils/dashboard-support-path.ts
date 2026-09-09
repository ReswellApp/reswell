export function isDashboardSupportDeskPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  return normalized === "/dashboard/support"
}
