import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useEffect, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

const APP_ICON = require("../../assets/images/icon.png")

type Step = "start" | "password" | "create"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthSheet({
  presented,
  onDismiss,
}: {
  presented: boolean
  onDismiss: () => void
}) {
  const colors = useReswellColors()
  const scheme = useColorScheme()
  const insets = useSafeAreaInsets()
  const { configured, signIn, signUp, signInWithGoogle } = useAuth()
  const [step, setStep] = useState<Step>("start")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (presented) return
    setStep("start")
    setEmail("")
    setPassword("")
    setFirstName("")
    setLastName("")
    setError(null)
    setBusy(false)
  }, [presented])

  const emailReady = EMAIL_PATTERN.test(email.trim())
  const canContinue = emailReady && !busy
  const canSignIn = emailReady && password.length > 0 && !busy
  const canSubmitCreate =
    step === "create" &&
    emailReady &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    password.length > 0 &&
    !busy

  async function run(task: () => Promise<string | null>) {
    if (!configured) {
      setError("Sign-in is not configured in this build.")
      return
    }
    setBusy(true)
    setError(null)
    const message = await task()
    setError(message)
    setBusy(false)
  }

  const title =
    step === "create" ? "Create your account" : step === "password" ? "Sign in" : "Log in or sign up"

  return (
    <Modal visible={presented} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}
      >
            <View style={styles.grabberWrap} accessibilityElementsHidden>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.3)" : "rgba(60,60,67,0.3)" },
                ]}
              />
            </View>
            <View style={styles.sheetHeader}>
              {step !== "start" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={() => {
                    setError(null)
                    setPassword("")
                    setStep("start")
                  }}
                  style={styles.headerSide}
                >
                  <SymbolView
                    name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                    size={20}
                    tintColor={colors.foreground}
                  />
                </Pressable>
              ) : (
                <View style={styles.headerSide} />
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onDismiss} style={styles.headerSide}>
                <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={16} tintColor={colors.muted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={styles.scrollBody}>
              <View style={styles.brand}>
                <Image source={APP_ICON} style={styles.brandIcon} contentFit="cover" accessibilityLabel="Reswell" />
              </View>

              <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>

              {step === "start" ? (
                <View style={styles.stack}>
                  <SocialButton
                    label="Continue with Google"
                    disabled={busy}
                    onPress={() => void run(signInWithGoogle)}
                    icon={<GoogleMark />}
                  />

                  <View style={styles.divider}>
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
                    <Text style={[styles.or, { color: colors.muted, fontFamily: fontFamily.text }]}>or</Text>
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="Enter email address"
                    placeholderTextColor="#A3A3A3"
                    value={email}
                    onChangeText={setEmail}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />

                  {error ? (
                    <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canContinue}
                    onPress={() => {
                      setError(null)
                      setStep("password")
                    }}
                    style={[styles.primary, { backgroundColor: canContinue ? colors.foreground : "#ECECEF" }]}
                  >
                    <Text
                      style={[
                        styles.primaryLabel,
                        { color: canContinue ? colors.background : "#C8C8CC", fontFamily: fontFamily.text },
                      ]}
                    >
                      Continue
                    </Text>
                  </Pressable>
                </View>
              ) : step === "password" ? (
                <View style={styles.stack}>
                  <Text style={[styles.emailEcho, { color: colors.muted, fontFamily: fontFamily.text }]}>{email.trim()}</Text>
                  <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Password</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="password"
                    secureTextEntry
                    placeholder="Password"
                    placeholderTextColor="#A3A3A3"
                    value={password}
                    onChangeText={setPassword}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />

                  {error ? (
                    <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSignIn}
                    onPress={() => void run(() => signIn(email, password))}
                    style={[styles.primary, { backgroundColor: canSignIn ? colors.foreground : "#ECECEF" }]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text
                        style={[
                          styles.primaryLabel,
                          { color: canSignIn ? colors.background : "#C8C8CC", fontFamily: fontFamily.text },
                        ]}
                      >
                        Sign in
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setError(null)
                      setStep("create")
                    }}
                  >
                    <Text style={[styles.secondaryLink, { color: colors.muted, fontFamily: fontFamily.text }]}>
                      New here? Create an account
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.stack}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor="#A3A3A3"
                    value={email}
                    onChangeText={setEmail}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />
                  <TextInput
                    autoComplete="given-name"
                    placeholder="First name"
                    placeholderTextColor="#A3A3A3"
                    value={firstName}
                    onChangeText={setFirstName}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />
                  <TextInput
                    autoComplete="family-name"
                    placeholder="Last name"
                    placeholderTextColor="#A3A3A3"
                    value={lastName}
                    onChangeText={setLastName}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    secureTextEntry
                    placeholder="Password"
                    placeholderTextColor="#A3A3A3"
                    value={password}
                    onChangeText={setPassword}
                    style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
                  />

                  {error ? (
                    <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    disabled={!canSubmitCreate}
                    onPress={() => {
                      const problem = passwordProblem(password)
                      if (problem) {
                        setError(problem)
                        return
                      }
                      void run(() => signUp({ email, password, firstName, lastName }))
                    }}
                    style={[styles.primary, { backgroundColor: canSubmitCreate ? colors.foreground : "#ECECEF" }]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={[styles.primaryLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
                        Create account
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function SocialButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string
  icon: ReactNode
  disabled: boolean
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.social, { borderColor: "#E4E4E7", backgroundColor: colors.background }]}
    >
      {icon}
      <Text style={[styles.socialLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

function GoogleMark() {
  return (
    <View style={styles.googleWrap}>
      <Text style={[styles.googleLetter, { color: "#4285F4" }]}>G</Text>
    </View>
  )
}

function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters."
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter."
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter."
  if (!/[0-9]/.test(password)) return "Password must include a number."
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character."
  return null
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 24,
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 4,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    flexGrow: 0,
    paddingBottom: 8,
  },
  brand: {
    alignItems: "center",
    marginBottom: 16,
  },
  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 20,
    textAlign: "center",
  },
  stack: { gap: 12 },
  social: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialLabel: { fontSize: 16, fontWeight: "600" },
  googleWrap: { width: 20, alignItems: "center" },
  googleLetter: { fontSize: 18, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 14 },
  fieldLabel: { fontSize: 14, fontWeight: "500", alignSelf: "flex-start" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  primary: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryLabel: { fontSize: 17, fontWeight: "600" },
  emailEcho: { fontSize: 15, textAlign: "center", marginBottom: 4 },
  secondaryLink: { fontSize: 14, textAlign: "center", marginTop: 4 },
  error: { fontSize: 14, textAlign: "center" },
})
