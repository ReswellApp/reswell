import * as AppleAuthentication from "expo-apple-authentication"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { MobileMe } from "@reswell/api-contract"
import { Wordmark } from "@/components/wordmark"
import { fetchMe } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function SignInScreen() {
  const colors = useReswellColors()
  const { configured, session, signIn, signInWithGoogle, signInWithApple, signOut } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [me, setMe] = useState<MobileMe | null>(null)

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false))
  }, [])

  useEffect(() => {
    const token = session?.access_token
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
  }, [session?.access_token])

  async function submit() {
    setBusy(true)
    setError(null)
    const message = await signIn(email, password)
    setError(message)
    setBusy(false)
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Wordmark />
      {!configured ? (
        <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>
          Add the Supabase URL and anon key to apps/mobile/.env before signing in.
        </Text>
      ) : session ? (
        <View style={styles.stack}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {me?.display_name ?? "Signed in"}
          </Text>
          {me?.email ? (
            <Text style={{ color: colors.muted, fontFamily: fontFamily.text }}>{me.email}</Text>
          ) : null}
          <Pressable onPress={() => void signOut()} style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Sign out
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Sign in</Text>
          <Pressable
            disabled={busy}
            onPress={() => {
              setBusy(true)
              setError(null)
              void signInWithGoogle().then((message) => {
                setError(message)
                setBusy(false)
              })
            }}
            style={[styles.google, { backgroundColor: "#F0F2F5" }]}
          >
            <Text style={styles.googleMark}>G</Text>
            <Text style={[styles.googleLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Continue with Google
            </Text>
          </Pressable>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
          <TextInput
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
          {error ? (
            <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.buttonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                Sign in
              </Text>
            )}
          </Pressable>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                colors.background === "#FFFFFF"
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={8}
              style={styles.apple}
              onPress={() => {
                setBusy(true)
                setError(null)
                void signInWithApple().then((message) => {
                  setError(message)
                  setBusy(false)
                })
              }}
            />
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 28 },
  stack: { gap: 12 },
  title: { fontSize: 32, fontWeight: "700", letterSpacing: -0.8 },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  button: {
    borderRadius: 8,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  google: {
    minHeight: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "700" },
  googleLabel: { fontSize: 16, fontWeight: "600" },
  apple: { width: "100%", height: 48 },
  error: { fontSize: 15 },
})
