import { DashboardProfileSettings } from "@/components/features/dashboard/dashboard-profile-settings"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchDashboardProfile } from "@/lib/db/dashboard-profile"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { loadMessageSmsNotificationsStateForUser } from "@/lib/services/messageSmsNotifications"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Profile — Reswell",
  description: "Update your display name, bio, location, and shipping addresses for your Reswell account.",
  path: "/dashboard/profile",
})

export default async function DashboardProfilePage() {
  const { supabase, user } = await getCachedDashboardSession()
  if (!user) return null

  const [{ profile, error: profileError }, { addresses, error: addressesError }, smsState] =
    await Promise.all([
      fetchDashboardProfile(supabase, user.id),
      fetchProfileAddresses(supabase, user.id),
      loadMessageSmsNotificationsStateForUser(user.id, user.phone),
    ])

  if (profileError) {
    console.error("[dashboard/profile] profile fetch failed", {
      userId: user.id,
      message: profileError,
      timestamp: new Date().toISOString(),
    })
  }

  if (addressesError) {
    console.error("[dashboard/profile] addresses fetch failed", {
      userId: user.id,
      message: addressesError,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <DashboardProfileSettings
      initialProfile={profile}
      profileFetchError={profileError}
      initialAddresses={addresses}
      addressesFetchError={addressesError}
      initialMessageSmsOptIn={smsState.message_sms_opt_in}
      initialHasSmsPhone={smsState.has_phone}
    />
  )
}
