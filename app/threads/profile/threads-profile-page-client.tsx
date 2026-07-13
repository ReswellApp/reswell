"use client"

import { useEffect } from "react"
import { useAuthModal } from "@/components/auth/auth-modal-context"
import { DashboardProfileSettings } from "@/components/features/dashboard/dashboard-profile-settings"
import { ThreadsProfilePageHeader } from "@/components/features/forum/threads-profile-page-header"
import { createClient } from "@/lib/supabase/client"
import type { DashboardProfileRow } from "@/lib/db/dashboard-profile"
import type { ProfileAddressRow } from "@/lib/profile-address"

type ThreadsProfilePageClientProps = {
  initialProfile: DashboardProfileRow | null
  profileFetchError?: string
  initialAddresses: ProfileAddressRow[]
  addressesFetchError?: string
  initialMessageSmsOptIn?: boolean
  initialHasSmsPhone?: boolean
  initialSmsPhone?: string | null
}

export function ThreadsProfilePageClient(props: ThreadsProfilePageClientProps) {
  const authModal = useAuthModal()

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        authModal.openLogin("/threads/profile")
      }
    })()
  }, [authModal])

  const profile = props.initialProfile

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {profile ? (
        <ThreadsProfilePageHeader
          displayName={profile.display_name?.trim() || "Member"}
          email={profile.email}
          avatarUrl={profile.avatar_url}
          bio={profile.bio}
        />
      ) : null}
      <DashboardProfileSettings variant="threads" {...props} />
    </div>
  )
}
