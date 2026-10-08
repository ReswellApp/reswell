import { Stack, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileMe } from "@reswell/api-contract"
import { AccountRow } from "@/components/account-row"
import { fetchMe } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

const LINKS = [
  { path: "/account/favorites", label: "Favorites" },
  { path: "/account/following", label: "Following" },
  { path: "/account/cart", label: "Cart" },
  { path: "/account/offers", label: "Offers" },
  { path: "/account/purchases", label: "Purchases" },
  { path: "/account/sales", label: "Sales" },
  { path: "/account/messages", label: "Messages" },
] as const

export default function AccountScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session, signOut } = useAuth()
  const [me, setMe] = useState<MobileMe | null>(null)
  const token = session?.access_token

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }
    let cancelled = false
    fetchMe(token)
      .then((next) => {
        if (!cancelled) setMe(next)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Account" }} />
      {!token ? (
        <View style={styles.signedOut}>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Sign in</Text>
          <Pressable onPress={() => router.push("/sign-in")} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Sign in
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {me?.display_name ?? "Account"}
          </Text>
          {me?.email ? (
            <Text style={[styles.email, { color: colors.muted, fontFamily: fontFamily.text }]}>{me.email}</Text>
          ) : null}
          {me?.seller_slug ? (
            <AccountRow
              title="Your profile"
              onPress={() => {
                const slug = me.seller_slug
                if (slug) router.push({ pathname: "/profile/[slug]", params: { slug } })
              }}
            />
          ) : null}
          {LINKS.map((link) => (
            <AccountRow key={link.path} title={link.label} onPress={() => router.push(link.path)} />
          ))}
          <Pressable onPress={() => void signOut()} style={styles.signOut}>
            <Text style={[styles.signOutLabel, { color: colors.destructive, fontFamily: fontFamily.text }]}>Sign out</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  signedOut: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  list: { paddingBottom: 32 },
  name: { fontSize: 28, fontWeight: "700", letterSpacing: -0.6, paddingHorizontal: 16, paddingTop: 8 },
  email: { fontSize: 15, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  button: { borderRadius: 8, minHeight: 48, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  signOut: { paddingHorizontal: 16, paddingVertical: 20 },
  signOutLabel: { fontSize: 16, fontWeight: "600" },
})
