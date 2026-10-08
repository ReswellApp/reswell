import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
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
  const router = useRouter()
  const { session } = useAuth()
  const [busy, setBusy] = useState<"save" | "cart" | "message" | null>(null)
  const [draft, setDraft] = useState("")
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
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() =>
            void run("save", async (accessToken) => {
              const next = !listing.favorited
              const result = await setFavorite(accessToken, listing.id, next)
              onChange({ ...listing, favorited: result.favorited })
            })
          }
          style={[styles.button, { borderColor: colors.border }]}
        >
          {busy === "save" ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {listing.favorited ? "Saved" : "Save"}
            </Text>
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
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          {busy === "cart" ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.label, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {listing.in_cart ? "Remove" : "Add to cart"}
            </Text>
          )}
        </Pressable>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Message the seller"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
      />
      <Pressable
        onPress={() => {
          const body = draft.trim()
          if (!body) return
          void run("message", async (accessToken) => {
            const result = await sendListingMessage(accessToken, listing.id, body)
            setDraft("")
            router.push({ pathname: "/account/messages/[id]", params: { id: result.conversation_id } })
          })
        }}
        style={[styles.button, { borderColor: colors.border }]}
      >
        {busy === "message" ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>Send message</Text>
        )}
      </Pressable>
      {notice ? <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  label: { fontSize: 16, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  notice: { fontSize: 15 },
})
