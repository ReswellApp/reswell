export const ADMIN_SALE_TIP_STATUSES = ["pending", "succeeded", "canceled", "failed"] as const

export type AdminSaleTipStatus = (typeof ADMIN_SALE_TIP_STATUSES)[number]

export const ADMIN_SALE_TIP_PAGE_SIZE = 50

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAdminSaleTipStatus(value: string): value is AdminSaleTipStatus {
  return (ADMIN_SALE_TIP_STATUSES as readonly string[]).includes(value)
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Keep search text safe to embed in a PostgREST `or` filter. */
export function sanitizeAdminSaleTipSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9 @.+_'-]/g, "").trim().slice(0, 80)
}

export function adminSaleTipStatusPresentation(status: AdminSaleTipStatus): {
  label: string
  tone: "green" | "amber" | "red" | "slate"
} {
  switch (status) {
    case "succeeded":
      return { label: "Paid", tone: "green" }
    case "pending":
      return { label: "Pending", tone: "amber" }
    case "failed":
      return { label: "Failed", tone: "red" }
    case "canceled":
      return { label: "Canceled", tone: "slate" }
  }
}

export function summarizeSucceededTips(
  rows: { amountCents: number; sellerUserId: string }[],
): { amountCents: number; sellerCount: number } {
  const sellers = new Set<string>()
  let amountCents = 0
  for (const row of rows) {
    if (row.amountCents > 0) amountCents += row.amountCents
    if (row.sellerUserId) sellers.add(row.sellerUserId)
  }
  return { amountCents, sellerCount: sellers.size }
}

export function adminSaleTipListHref(input: {
  status: AdminSaleTipStatus | "all"
  q: string
  seller: string
  page: number
}): string {
  const params = new URLSearchParams()
  if (input.status !== "succeeded") params.set("status", input.status)
  if (input.q) params.set("q", input.q)
  if (input.seller) params.set("seller", input.seller)
  if (input.page > 1) params.set("page", String(input.page))
  const qs = params.toString()
  return qs ? `/admin/sale-tips?${qs}` : "/admin/sale-tips"
}
