import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileListingDetail } from "@reswell/api-contract"
import { sendListingMessage, setCartItem, setFavorite } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export function ListingActions({
  listing,
  onChange,
}: {
  listing: MobileListingDetail
  onChange: (next: MobileListingDetail) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const [busy, setBusy] = useState<"save" | "cart" | "message" | null>(null)
  const [draft, setDraft] = useState("")
  const [composing, setComposing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const token = session?.access_token

  function requireSignIn() {
    if (token) return true
    router.push("/sign-in")
    return false
  }

  async function run(kind: "save" | "cart" | "message", task: (accessToken: string) => Promise<void>) {
    if (!requireSignIn() || !token || busy) return
    setBusy(kind)
    setNotice(null)
    try {
      await task(token)
    } catch (cause: unknown) {
      setNotice(cause instanceof Error ? cause.message : "Could not save that change")
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {composing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the seller"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.image, fontFamily: fontFamily.text }]}
        />
      ) : null}
      {notice ? <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listing.favorited ? "Saved" : "Save"}
          onPress={() =>
            void run("save", async (accessToken) => {
              const next = !listing.favorited
              const result = await setFavorite(accessToken, listing.id, next)
              onChange({ ...listing, favorited: result.favorited })
            })
          }
          style={[styles.save, { borderColor: colors.border, backgroundColor: colors.background }]}
        >
          {busy === "save" ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <SymbolView
              name={{
                ios: listing.favorited ? "heart.fill" : "heart",
                android: listing.favorited ? "favorite" : "favorite_border",
                web: listing.favorited ? "favorite" : "favorite_border",
              }}
              size={22}
              tintColor={colors.foreground}
            />
          )}
        </Pressable>
        <Pressable
          onPress={() =>
            void run("cart", async (accessToken) => {
              const next = listing.in_cart ? 0 : 1
              const result = await setCartItem(accessToken, listing.id, next)
              onChange({ ...listing, in_cart: result.in_cart })
            })
          }
          style={[styles.cart, { backgroundColor: colors.primary }]}
        >
          {busy === "cart" ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.cartLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {listing.in_cart ? "Remove" : "Add to cart"}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            if (!composing) {
              setComposing(true)
              return
            }
            const body = draft.trim()
            if (!body) return
            void run("message", async (accessToken) => {
              const result = await sendListingMessage(accessToken, listing.id, body)
              setDraft("")
              setComposing(false)
              router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } })
            })
          }}
          style={[styles.message, { borderColor: colors.border }]}
        >
          {busy === "message" ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <SymbolView name={{ ios: "bubble.left", android: "chat_bubble", web: "chat_bubble" }} size={20} tintColor={colors.foreground} />
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  save: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cart: { flex: 1, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  cartLabel: { fontSize: 16, fontWeight: "700" },
  message: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  notice: { fontSize: 14 },
})
