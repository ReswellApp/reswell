import type { Metadata } from "next"
import { ThreadsProfilePageClient } from "@/app/threads/profile/threads-profile-page-client"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { fetchDashboardProfile } from "@/lib/db/dashboard-profile"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { loadMessageSmsNotificationsStateForUser } from "@/lib/services/messageSmsNotifications"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata: Metadata = pageSeoMetadata({
  title: "Profile · Threads · Reswell",
  description: "Manage your Threads display name, photo, bio, and account settings.",
  path: "/threads/profile",
  robots: { index: false, follow: false },
})

export default async function ThreadsProfilePage() {
  const { supabase, user } = await getCachedDashboardSession()

  if (!user) {
    return <ThreadsProfilePageClient initialProfile={null} initialAddresses={[]} />
  }

  const [{ profile, error: profileError }, { addresses, error: addressesError }, smsState] =
    await Promise.all([
      fetchDashboardProfile(supabase, user.id),
      fetchProfileAddresses(supabase, user.id),
      loadMessageSmsNotificationsStateForUser(user.id, user.phone),
    ])

  if (profileError) {
    console.error("[threads/profile] profile fetch failed", {
      userId: user.id,
      message: profileError,
      timestamp: new Date().toISOString(),
    })
  }

  if (addressesError) {
    console.error("[threads/profile] addresses fetch failed", {
      userId: user.id,
      message: addressesError,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <ThreadsProfilePageClient
      initialProfile={profile}
      profileFetchError={profileError}
      initialAddresses={addresses}
      addressesFetchError={addressesError}
      initialMessageSmsOptIn={smsState.message_sms_opt_in}
      initialHasSmsPhone={smsState.has_phone}
      initialSmsPhone={smsState.phone}
    />
  )
}
