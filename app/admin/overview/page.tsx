import { redirect } from 'next/navigation'
import { adminInsightsYearMonthSchema } from '@/lib/utils/adminInsightsPeriod'

type AdminOverviewRedirectProps = {
  searchParams: Promise<{ month?: string }>
}

/** Overview now lives on `/admin/home`. Keep old links working. */
export default async function AdminOverviewRedirect({ searchParams }: AdminOverviewRedirectProps) {
  const { month } = await searchParams
  const parsed = adminInsightsYearMonthSchema.safeParse(month?.trim())
  if (parsed.success) {
    redirect(`/admin/home?month=${encodeURIComponent(parsed.data)}`)
  }
  redirect('/admin/home')
}
