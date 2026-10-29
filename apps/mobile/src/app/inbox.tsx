import { Image } from "expo-image"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { MobileInbox } from "@reswell/api-contract"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { ReswellInboxActivityIcon } from "@/components/reswell-icons"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { fetchInbox, markInboxNotificationRead } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { inboxItemNotificationId, inboxItemToNative } from "@/lib/inbox-href"
import { requestPushPermissionAndRegister } from "@/lib/push-token"
import { useSyncInboxUnreadCount } from "@/lib/inbox-unread-count"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type Filter = "all" | "messages" | "selling" | "buying" | "activity"

const FILTERS: { id: Exclude<Filter, "activity">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "messages", label: "Messages" },
  { id: "selling", label: "Selling" },
  { id: "buying", label: "Buying" },
]

function inboxFilterFromParam(value: string | string[] | undefined): Filter {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === "messages" || raw === "selling" || raw === "buying" || raw === "activity") return raw
  return "all"
}

export default function InboxScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const signedIn = Boolean(session?.access_token)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack insetTop bordered={false} />
      {signedIn ? (
        <InboxList />
      ) : (
          <View style={styles.centered}>
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>Sign in to see messages and notifications.</Text>
            <Pressable onPress={() => requestAuth()} style={[styles.signIn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.signInLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Sign in</Text>
            </Pressable>
          </View>
      )}
    </View>
  )
}

function InboxList() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const tabBarInset = useFloatingTabBarContentInset()
  const syncInboxUnread = useSyncInboxUnreadCount()
  const [readItemIds, setReadItemIds] = useState<Set<string>>(() => new Set())
  const readItemIdsRef = useRef(readItemIds)
  readItemIdsRef.current = readItemIds
  const load = useCallback(
    (accessToken: string) =>
      fetchInbox(accessToken).then((inbox) => {
        syncInboxUnread(inbox.unread_count)
        return inbox
      }),
    [syncInboxUnread],
  )
  const { data, error, loading, reload } = useAccountResource(load)
  const params = useLocalSearchParams<{ filter?: string }>()
  const [filter, setFilter] = useState<Filter>(() => inboxFilterFromParam(params.filter))

  useEffect(() => {
    setFilter(inboxFilterFromParam(params.filter))
  }, [params.filter])

  const selectFilter = (next: Filter) => {
    setFilter(next)
    router.setParams({ filter: next })
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload()
    })
    return () => subscription.remove()
  }, [reload])

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    void requestPushPermissionAndRegister(token)
  }, [session?.access_token])

  const items = useMemo(() => {
    return (data?.items ?? [])
      .map((item) => (readItemIds.has(item.id) ? { ...item, unread: false } : item))
      .filter((item) => {
        if (filter === "activity") return item.kind === "notification"
        if (filter === "messages") return item.kind === "message"
        if (filter === "selling" || filter === "buying") return item.bucket === filter
        return true
      })
  }, [data?.items, filter, readItemIds])

  const activityActive = filter === "activity"
  const hasUnreadNotifications = (data?.items ?? []).some(
    (item) => item.kind === "notification" && item.unread && !readItemIds.has(item.id),
  )

  const openItem = useCallback(
    (item: MobileInbox["items"][number]) => {
      if (item.kind === "notification" && item.unread && !readItemIdsRef.current.has(item.id)) {
        const next = new Set(readItemIdsRef.current)
        next.add(item.id)
        readItemIdsRef.current = next
        setReadItemIds(next)
        const notificationId = inboxItemNotificationId(item.id)
        const token = session?.access_token
        if (notificationId && token) {
          void markInboxNotificationRead(token, notificationId).catch(() => undefined)
        }
      }
      router.push(inboxItemToNative(item))
    },
    [router, session?.access_token],
  )

  return (
    <View style={styles.inboxBody}>
      <View style={styles.filterBar}>
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <Pressable
                key={item.id}
                onPress={() => selectFilter(item.id)}
                style={[
                  styles.pill,
                  styles.pillFlex,
                  {
                    backgroundColor: active ? colors.foreground : colors.background,
                    borderColor: active ? colors.foreground : colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={[
                    styles.pillLabel,
                    { color: active ? colors.background : colors.foreground, fontFamily: fontFamily.text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Activity notifications"
            accessibilityState={{ selected: activityActive }}
            onPress={() => selectFilter("activity")}
            style={[
              styles.pill,
              styles.pillIcon,
              {
                backgroundColor: activityActive ? colors.foreground : colors.background,
                borderColor: activityActive ? colors.foreground : colors.border,
              },
            ]}
          >
            <ReswellInboxActivityIcon
              tintColor={activityActive ? colors.background : colors.foreground}
            />
            {hasUnreadNotifications && !activityActive ? (
              <View style={[styles.pillUnreadDot, { backgroundColor: colors.destructive, borderColor: colors.background }]} />
            ) : null}
          </Pressable>
        </View>
      </View>
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[tabBarInset, items.length === 0 ? styles.listEmpty : null]}
        refreshing={loading}
        onRefresh={reload}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {error ?? (loading ? "Loading inbox…" : "Nothing in your inbox yet.")}
          </Text>
        }
        renderItem={({ item }) => <InboxRow item={item} onPress={() => openItem(item)} />}
      />
    </View>
  )
}

function InboxRow({ item, onPress }: { item: MobileInbox["items"][number]; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.image }]}>
          <SymbolView
            name={{ ios: item.kind === "notification" ? "bell" : "bubble.left", android: "notifications", web: "notifications" }}
            size={18}
            tintColor={colors.muted}
          />
        </View>
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {item.title}
        </Text>
        {item.preview ? (
          <Text
            numberOfLines={1}
            style={[
              styles.preview,
              {
                color: item.unread ? colors.foreground : colors.muted,
                fontFamily: fontFamily.text,
                fontWeight: item.unread ? "700" : "400",
              },
            ]}
          >
            {item.preview}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.time_label}</Text>
      </View>
      {item.unread ? <View style={[styles.dot, { backgroundColor: colors.destructive }]} /> : <View style={styles.dotSpacer} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pillUnreadDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  inboxBody: { flex: 1 },
  filterBar: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexGrow: 0,
    flexShrink: 0,
  },
  filters: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 9 },
  pillFlex: { flex: 1, minWidth: 0, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  pillIcon: {
    flexShrink: 0,
    width: 40,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pillLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  list: { flex: 1 },
  listEmpty: { flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  preview: { fontSize: 14, lineHeight: 18 },
  time: { fontSize: 13, marginTop: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSpacer: { width: 8 },
  empty: { textAlign: "center", padding: 24, fontSize: 15 },
  signIn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  signInLabel: { fontSize: 16, fontWeight: "700" },
})
