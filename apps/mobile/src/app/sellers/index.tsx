import { Image } from "expo-image"
import { Stack, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileSellerCard, MobileSellersPage } from "@reswell/api-contract"
import { VerticalScroll } from "@/components/horizontal-rail"
import { fetchSellers } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellersScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState("")
  const [page, setPage] = useState<MobileSellersPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetchSellers(draft)
        .then((next) => {
          if (!cancelled) {
            setPage(next)
            setError(null)
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load sellers")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, draft.trim() ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft])

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()}>
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={22} tintColor={colors.foreground} />
        </Pressable>
        <Text style={[styles.barTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
          {page?.title ?? "Sellers"}
        </Text>
      </View>
      <VerticalScroll contentContainerStyle={styles.body}>
        {page ? (
          <>
            <Text style={[styles.description, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.description}</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={page.search_placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.search, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
            />
            {page.summary ? (
              <Text style={[styles.summary, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.summary}</Text>
            ) : null}
          </>
        ) : null}
        {loading && !page ? <ActivityIndicator color={colors.foreground} style={styles.spinner} /> : null}
        {error && !page ? (
          <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
        ) : null}
        {page && page.sellers.length === 0 && !loading ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{page.empty_title}</Text>
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.empty_body}</Text>
          </View>
        ) : null}
        {page?.sellers.map((seller) => (
          <SellerRow
            key={seller.id}
            seller={seller}
            onPress={() => router.push({ pathname: "/sellers/[slug]", params: { slug: seller.slug } })}
          />
        ))}
      </VerticalScroll>
    </View>
  )
}

function SellerRow({ seller, onPress }: { seller: MobileSellerCard; onPress: () => void }) {
  const colors = useReswellColors()
  const photo = seller.image_urls[0] ?? seller.avatar_url
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { borderBottomColor: colors.border }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={[styles.photo, { backgroundColor: colors.image }]} contentFit="cover" />
      ) : (
        <View style={[styles.photo, { backgroundColor: colors.image }]} />
      )}
      <View style={styles.copy}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{seller.name}</Text>
        {seller.lines.map((line, index) => (
          <Text key={`${index}-${line}`} style={[styles.line, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {line}
          </Text>
        ))}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  body: { paddingBottom: 40 },
  description: { fontSize: 15, lineHeight: 21, paddingHorizontal: 16, paddingTop: 16 },
  search: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  summary: { paddingHorizontal: 16, paddingTop: 14, fontSize: 14 },
  spinner: { marginTop: 24 },
  emptyBlock: { paddingHorizontal: 24, paddingTop: 32, gap: 8 },
  emptyTitle: { textAlign: "center", fontSize: 18, fontWeight: "700" },
  empty: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  photo: { width: 72, height: 72, borderRadius: 12 },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "700" },
  line: { fontSize: 13, lineHeight: 18 },
})
