'use server'

import {
  enableMessageSmsNotificationsWithPhone,
  loadMessageSmsNotificationsStateForUser,
  updateMessageSmsNotificationsOptIn,
  type EnableMessageSmsWithPhoneResult,
  type MessageSmsNotificationsState,
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

export async function enableMessageSmsNotificationsWithPhoneAction(
  phone: string,
): Promise<EnableMessageSmsWithPhoneResult> {
  return enableMessageSmsNotificationsWithPhone({ phone })
}
