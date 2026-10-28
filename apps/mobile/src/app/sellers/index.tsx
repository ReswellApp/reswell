import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileSellerCard, MobileSellersPage } from "@reswell/api-contract"
import { SellerDirectoryCard } from "@/components/sellers/seller-directory-card"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { SCREEN_GUTTER, ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { fetchSellers, setFollow } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

export default function SellersScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const { requestAuth } = useAuthGate()
  const token = session?.access_token ?? null
  const [draft, setDraft] = useState("")
  const [page, setPage] = useState<MobileSellersPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetchSellers(draft, token)
        .then((next) => {
          if (!cancelled) {
            setPage(next)
            setError(null)
            setFollowOverrides({})
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
  }, [draft, token])

  const handleFollow = useCallback(
    (seller: MobileSellerCard) => {
      if (!seller.show_follow) return
      const current = followOverrides[seller.id] ?? seller.following ?? false
      const next = !current
      if (!token) {
        requestAuth()
        return
      }
      setFollowBusyId(seller.id)
      setFollowOverrides((prev) => ({ ...prev, [seller.id]: next }))
      setFollow(token, seller.id, next)
        .catch(() => {
          setFollowOverrides((prev) => ({ ...prev, [seller.id]: current }))
        })
        .finally(() => setFollowBusyId(null))
    },
    [followOverrides, requestAuth, token],
  )

  return (
    <ScreenShell style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack onBack={() => router.back()} />
      <ScreenScroll contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.body}>
        <View style={[styles.hero, { borderBottomColor: colors.border, backgroundColor: colors.secondary }]}>
          <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {page?.title ?? "Sellers"}
          </Text>
          {page ? (
            <>
              <Text style={[styles.description, { color: colors.muted, fontFamily: fontFamily.text }]}>
                {page.description}
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={page.search_placeholder}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[
                  styles.search,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    fontFamily: fontFamily.text,
                  },
                ]}
              />
              {page.summary ? (
                <Text style={[styles.summary, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {page.summary}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {loading && !page ? <ActivityIndicator color={colors.foreground} style={styles.spinner} /> : null}
        {error && !page ? (
          <Text style={[styles.empty, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
        ) : null}
        {page && page.sellers.length === 0 && !loading ? (
          <View style={styles.emptyBlock}>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {page.empty_title}
            </Text>
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>{page.empty_body}</Text>
          </View>
        ) : null}
        {page?.sellers.map((seller) => (
          <SellerDirectoryCard
            key={seller.id}
            seller={seller}
            following={followOverrides[seller.id] ?? seller.following === true}
            followBusy={followBusyId === seller.id}
            onPress={() => router.push({ pathname: "/sellers/[slug]", params: { slug: seller.slug } })}
            onPressFollow={() => handleFollow(seller)}
          />
        ))}
      </ScreenScroll>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  body: { paddingBottom: 32 },
  hero: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pageTitle: { fontSize: 26, lineHeight: 30, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  search: {
    marginTop: 6,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  summary: { textAlign: "center", fontSize: 13, marginTop: 2 },
  spinner: { marginTop: 24 },
  emptyBlock: { paddingHorizontal: 24, paddingTop: 32, gap: 8 },
  emptyTitle: { textAlign: "center", fontSize: 18, fontWeight: "700" },
  empty: { textAlign: "center", fontSize: 15, lineHeight: 21 },
})
