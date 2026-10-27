"use client"

import { MessageSmsNotificationsToggle } from "@/components/features/messages/message-sms-notifications-toggle"
import {
  LocalPickupNearMePreferenceSection,
  type LocalPickupNearMePreferenceCopy,
} from "@/components/features/dashboard/local-pickup-near-me-preference-section"
import {
  profileCardClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"
import type { LocalPickupNearMePreference } from "@/lib/db/localPickupNearMePreference"

export type ProfileNotificationsTabCopy = {
  intro: string
  messagesTitle: string
  localPickup: LocalPickupNearMePreferenceCopy
}

interface ProfileNotificationsTabProps {
  copy: ProfileNotificationsTabCopy
  initialMessageSmsOptIn: boolean
  initialPhone?: string | null
  initialLocalPickupNearMe: LocalPickupNearMePreference
}

export function ProfileNotificationsTab({
  copy,
  initialMessageSmsOptIn,
  initialPhone,
  initialLocalPickupNearMe,
}: ProfileNotificationsTabProps) {
  return (
    <div className="mx-auto max-w-xl space-y-8 pt-2">
      <p className={profileSectionHintClass}>{copy.intro}</p>

      <LocalPickupNearMePreferenceSection
        initialPreference={initialLocalPickupNearMe}
        copy={copy.localPickup}
      />

      <section className="space-y-3">
        <h2 className={profileSectionTitleClass}>{copy.messagesTitle}</h2>
        <div className={`${profileCardClass} px-5 sm:px-6`}>
          <MessageSmsNotificationsToggle
            initialOptIn={initialMessageSmsOptIn}
            initialPhone={initialPhone}
            className="border-b-0 px-0"
          />
        </div>
      </section>
    </div>
  )
}
