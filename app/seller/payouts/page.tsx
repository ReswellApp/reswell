import { redirect } from "next/navigation"

/** Stripe Connect return URLs use /seller/payouts; dashboard lives at /dashboard/payouts. */
export default async function SellerPayoutsRedirect(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await props.searchParams
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x))
    else q.set(k, v)
  }
  const suffix = q.toString() ? `?${q.toString()}` : ""
  redirect(`/dashboard/payouts${suffix}`)
}
