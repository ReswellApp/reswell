import * as Notifications from "expo-notifications"
import * as SecureStore from "expo-secure-store"
import { router } from "expo-router"
import { useEffect, type ReactNode } from "react"
import { Platform } from "react-native"
import { useAuth } from "@/lib/auth-context"
import { inboxItemToNative } from "@/lib/inbox-href"
import { registerPushTokenIfPermitted } from "@/lib/push-token"

const LAST_RESPONSE_KEY = "reswell.push_last_response"

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

let handledInitialResponse = false
const handledResponseIds = new Set<string>()

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function markResponseHandled(response: Notifications.NotificationResponse): Promise<boolean> {
  const id = response.notification.request.identifier
  if (handledResponseIds.has(id)) return false
  handledResponseIds.add(id)
  const seen = await SecureStore.getItemAsync(LAST_RESPONSE_KEY)
  if (seen === id) return false
  await SecureStore.setItemAsync(LAST_RESPONSE_KEY, id)
  return true
}

function openPushResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data
  router.push(
    inboxItemToNative({
      conversation_id: stringField(data?.conversation_id),
      support_case_id: stringField(data?.support_case_id),
      listing_id: stringField(data?.listing_id),
      href: stringField(data?.href),
      offer_id: stringField(data?.offer_id),
    }),
  )
}

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null

  useEffect(() => {
    if (Platform.OS === "web" || !accessToken) return
    void registerPushTokenIfPermitted(accessToken).catch(() => undefined)
  }, [accessToken])

  useEffect(() => {
    if (Platform.OS === "web") return

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void markResponseHandled(response).then((fresh) => {
        if (fresh) openPushResponse(response)
      })
    })

    if (!handledInitialResponse) {
      handledInitialResponse = true
      void Notifications.getLastNotificationResponseAsync().then(async (response) => {
        if (!response) return
        if (await markResponseHandled(response)) openPushResponse(response)
      })
    }

    return () => subscription.remove()
  }, [])

  return children
}
