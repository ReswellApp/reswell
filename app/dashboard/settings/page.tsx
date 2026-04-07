import { redirect } from 'next/navigation'

/** @deprecated Use /dashboard/profile */
export default function DashboardSettingsRedirectPage() {
  redirect('/dashboard/profile')
}
