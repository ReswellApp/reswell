import { Image } from "expo-image"
import { Stack, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileInbox } from "@reswell/api-contract"
import { useFloatingTabBarContentInset } from "@/components/floating-tab-bar"
import { fetchInbox } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type Filter = "all" | "messages" | "selling" | "buying" | "activity"

const FILTERS: { id: Exclude<Filter, "activity">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "messages", label: "Messages" },
  { id: "selling", label: "Selling" },
  { id: "buying", label: "Buying" },
]

export default function InboxScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const signedIn = Boolean(session?.access_token)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Inbox</Text>
        <View style={styles.headerSide} />
      </View>
      {signedIn ? <InboxList /> : (
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
  const tabBarInset = useFloatingTabBarContentInset()
  const load = useCallback((accessToken: string) => fetchInbox(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [filter, setFilter] = useState<Filter>("all")
  const items = (data?.items ?? []).filter((item) => {
    if (filter === "all") return true
    if (filter === "messages") return item.kind === "message"
    if (filter === "activity") return item.kind === "notification"
    return item.bucket === filter
  })

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={tabBarInset}
      refreshing={loading}
      onRefresh={reload}
      ListHeaderComponent={
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const active = filter === item.id
            return (
              <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.pill, { backgroundColor: active ? colors.foreground : colors.background, borderColor: colors.border }]}>
                <Text style={[styles.pillLabel, { color: active ? colors.background : colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
              </Pressable>
            )
          })}
          <Pressable onPress={() => setFilter(filter === "activity" ? "all" : "activity")} style={[styles.bell, { backgroundColor: filter === "activity" ? colors.foreground : colors.background, borderColor: colors.border }]}>
            <SymbolView name={{ ios: "bell", android: "notifications", web: "notifications" }} size={16} tintColor={filter === "activity" ? colors.background : colors.foreground} />
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {error ?? (loading ? "Loading inbox…" : "Nothing in your inbox yet.")}
        </Text>
      }
      renderItem={({ item }) => <InboxRow item={item} onPress={() => openInboxItem(router, item)} />}
    />
  )
}

function openInboxItem(router: ReturnType<typeof useRouter>, item: MobileInbox["items"][number]) {
  if (item.conversation_id) {
    router.push({ pathname: "/account/messages/[id]", params: { id: item.conversation_id } })
    return
  }
  if (item.support_case_id) {
    router.push({ pathname: "/account/support/[id]", params: { id: item.support_case_id } })
    return
  }
  if (item.listing_id) {
    router.push({ pathname: "/listing/[id]", params: { id: item.listing_id } })
  }
}

function InboxRow({ item, onPress }: { item: MobileInbox["items"][number]; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.image }]}>
          <SymbolView name={{ ios: item.kind === "notification" ? "bell" : "bubble.left", android: "notifications", web: "notifications" }} size={18} tintColor={colors.muted} />
        </View>
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.title}</Text>
        {item.preview ? (
          <Text numberOfLines={2} style={[styles.preview, { color: colors.muted, fontFamily: fontFamily.text, fontWeight: item.unread ? "700" : "400" }]}>
            {item.preview}
          </Text>
        ) : null}
        <Text style={[styles.time, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.time_label}</Text>
      </View>
      {item.unread ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  headerSide: { width: 28 },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  pill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  pillLabel: { fontSize: 14, fontWeight: "700" },
  bell: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "700" },
  preview: { fontSize: 14, lineHeight: 18 },
  time: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E11D48" },
  dotSpacer: { width: 8 },
  empty: { textAlign: "center", padding: 24, fontSize: 15 },
  signIn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  signInLabel: { fontSize: 16, fontWeight: "700" },
})
