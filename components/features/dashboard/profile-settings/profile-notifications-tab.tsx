"use client"

import { MessageSmsNotificationsToggle } from "@/components/features/messages/message-sms-notifications-toggle"
import {
  profileCardClass,
  profileSectionHintClass,
  profileSectionTitleClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"

export type ProfileNotificationsTabCopy = {
  intro: string
  messagesTitle: string
}

interface ProfileNotificationsTabProps {
  copy: ProfileNotificationsTabCopy
  initialMessageSmsOptIn: boolean
  initialPhone?: string | null
}

export function ProfileNotificationsTab({
  copy,
  initialMessageSmsOptIn,
  initialPhone,
}: ProfileNotificationsTabProps) {
  return (
    <div className="mx-auto max-w-xl space-y-6 pt-2">
      <p className={profileSectionHintClass}>{copy.intro}</p>

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
