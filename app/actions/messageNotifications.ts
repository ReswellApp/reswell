'use server'

import {
  loadMessageSmsNotificationsStateForUser,
  saveMessageSmsNotificationsWithPhone,
  updateMessageSmsNotificationsOptIn,
  type MessageSmsNotificationsState,
  type SaveMessageSmsWithPhoneResult,
  type UpdateMessageSmsNotificationsResult,
} from "@/lib/services/messageSmsNotifications"
import { createClient } from "@/lib/supabase/server"

export async function getMessageSmsNotificationsState(): Promise<
  { error: string } | MessageSmsNotificationsState
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadMessageSmsNotificationsStateForUser(user.id, user.phone)
}

export async function setMessageSmsNotificationsOptIn(
  enabled: boolean,
): Promise<UpdateMessageSmsNotificationsResult> {
  return updateMessageSmsNotificationsOptIn({ enabled })
}

export async function saveMessageSmsNotificationsWithPhoneAction(input: {
  phone: string
  enabled: boolean
}): Promise<SaveMessageSmsWithPhoneResult> {
  return saveMessageSmsNotificationsWithPhone(input)
}
