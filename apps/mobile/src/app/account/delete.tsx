import { Stack, useRouter } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { ScreenSearchHeader } from "@/components/screen-search-header"
import { deleteAccount } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

const CONFIRMATION = "DELETE"

export default function DeleteAccountScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session, signOut } = useAuth()
  const { requestAuth } = useAuthGate()
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = session?.access_token
  const canSubmit = confirmation.trim() === CONFIRMATION && !busy && Boolean(token)

  function submit() {
    if (!token || !canSubmit) return
    Alert.alert(
      "Delete your account?",
      "This can’t be undone. Your listings will be removed and you won’t be able to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            setBusy(true)
            setError(null)
            void deleteAccount(token)
              .then(async () => {
                await signOut()
                router.replace("/account")
              })
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Couldn't delete your account.")
              })
              .finally(() => setBusy(false))
          },
        },
      ],
    )
  }

  if (!token) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenSearchHeader showBack showInbox insetTop bordered={false} />
        <View style={styles.signedOut}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Delete account
          </Text>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Sign in to permanently delete your Reswell account.
          </Text>
          <Pressable onPress={() => requestAuth()} style={[styles.primary, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Sign in
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <ScreenShell>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenSearchHeader showBack showInbox insetTop bordered={false} />
      <ScreenScroll contentInsetAdjustmentBehavior="never">
        <View style={styles.page}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Delete account
          </Text>
          <Text style={[styles.body, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Permanently delete your Reswell account and the personal data we don’t need to keep for
            completed orders, payouts, or legal records.
          </Text>
          <View style={styles.bullets}>
            <Text style={[styles.bullet, { color: colors.muted, fontFamily: fontFamily.text }]}>
              You will be signed out and won’t be able to sign in again.
            </Text>
            <Text style={[styles.bullet, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Active listings are taken down. Your public profile is anonymized.
            </Text>
            <Text style={[styles.bullet, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Finish open purchases and sales, and cash out remaining earnings, before deleting.
            </Text>
            <Text style={[styles.bullet, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Completed sales, purchases, and payout records stay with a deleted display name where
              the law requires it.
            </Text>
          </View>
          <Pressable onPress={() => router.push("/account/purchases")}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>Open Purchases</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/account/sales")}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>Open Sales</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/account/earnings")}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>Open Earnings</Text>
          </Pressable>

          <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Type {CONFIRMATION} to confirm
          </Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder={CONFIRMATION}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
                fontFamily: fontFamily.text,
              },
            ]}
          />
          {error ? (
            <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
          ) : null}
          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={[
              styles.primary,
              {
                backgroundColor: colors.destructive,
                opacity: canSubmit ? 1 : 0.35,
              },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {busy ? "Deleting…" : "Delete account"}
            </Text>
          </Pressable>
        </View>
      </ScreenScroll>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  signedOut: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  page: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 12 },
  title: { fontSize: 32, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22 },
  bullets: { gap: 8, paddingLeft: 2 },
  bullet: { fontSize: 15, lineHeight: 21 },
  link: { fontSize: 16, fontWeight: "700", textDecorationLine: "underline" },
  label: { marginTop: 8, fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 15, lineHeight: 21 },
  primary: {
    marginTop: 8,
    borderRadius: 999,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
})
