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
import { useAuth, type AppleSignUpInput, type GoogleSignUpInput, type SignUpInput } from "@/lib/auth-context"
import { appleSignInAvailable } from "@/lib/apple-sign-in"
import { AuthSignUpForm } from "@/components/auth-sign-up-form"
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
  const { configured, signIn, signUp, signUpWithGoogle, signUpWithApple, signInWithGoogle, signInWithApple } = useAuth()
  const [step, setStep] = useState<Step>("start")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "ios")

  useEffect(() => {
    if (presented) return
    setStep("start")
    setEmail("")
    setPassword("")
    setError(null)
    setBusy(false)
    setConfirmEmail(false)
  }, [presented])

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setAppleAvailable(false)
      return
    }
    void appleSignInAvailable().then(setAppleAvailable)
  }, [])

  const emailReady = EMAIL_PATTERN.test(email.trim())
  const canContinue = emailReady && !busy
  const canSignIn = emailReady && password.length > 0 && !busy

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

  async function submitSignUp(input: SignUpInput) {
    if (!configured) {
      setError("Sign-in is not configured in this build.")
      return
    }
    setBusy(true)
    setError(null)
    const result = await signUp(input)
    if (result.status === "error") setError(result.message)
    if (result.status === "confirm_email") setConfirmEmail(true)
    setBusy(false)
  }

  async function submitGoogleSignUp(input: GoogleSignUpInput) {
    setBusy(true)
    setError(null)
    if (!configured) {
      setError("Sign-in is not configured in this build.")
      setBusy(false)
      return
    }
    const result = await signUpWithGoogle(input)
    if (result.status === "error") setError(result.message)
    setBusy(false)
  }

  async function submitAppleSignUp(input: AppleSignUpInput) {
    setBusy(true)
    setError(null)
    if (!configured) {
      setError("Sign-in is not configured in this build.")
      setBusy(false)
      return
    }
    const result = await signUpWithApple(input)
    if (result.status === "error") setError(result.message)
    setBusy(false)
  }

  const title = confirmEmail
    ? "Check your email"
    : step === "create"
      ? "Create an account"
      : step === "password"
        ? "Sign in"
        : "Log in or sign up"

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
                    if (confirmEmail) {
                      setConfirmEmail(false)
                      setPassword("")
                      setStep(email.trim() ? "password" : "start")
                      return
                    }
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

            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.scroll}
              contentContainerStyle={styles.scrollBody}
            >
              {step === "create" && !confirmEmail ? null : (
                <View style={styles.brand}>
                  <Image source={APP_ICON} style={styles.brandIcon} contentFit="cover" accessibilityLabel="Reswell" />
                </View>
              )}

              <Text
                style={[
                  styles.title,
                  step === "create" && !confirmEmail ? styles.titleCompact : null,
                  { color: colors.foreground, fontFamily: fontFamily.headline },
                ]}
              >
                {title}
              </Text>

              {step === "start" ? (
                <View style={styles.stack}>
                  {appleAvailable ? (
                    <SocialButton
                      label="Continue with Apple"
                      disabled={busy}
                      onPress={() => void run(signInWithApple)}
                      icon={<AppleMark />}
                    />
                  ) : null}
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

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setError(null)
                      setConfirmEmail(false)
                      setStep("create")
                    }}
                  >
                    <Text style={[styles.secondaryLink, { color: colors.muted, fontFamily: fontFamily.text }]}>
                      New to Reswell? Create an account
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
              ) : confirmEmail ? (
                <View style={styles.stack}>
                  <Text style={[styles.emailEcho, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    We sent a confirmation link to {email.trim()}. Open it to finish creating your account, then sign in.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setError(null)
                      setConfirmEmail(false)
                      setPassword("")
                      setStep("password")
                    }}
                    style={[styles.primary, { backgroundColor: colors.foreground }]}
                  >
                    <Text style={[styles.primaryLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
                      Back to sign in
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <AuthSignUpForm
                  email={email}
                  onEmailChange={setEmail}
                  busy={busy}
                  error={error}
                  onSubmit={(input) => void submitSignUp(input)}
                  onGoogle={(input) => void submitGoogleSignUp(input)}
                  onApple={appleAvailable ? (input) => void submitAppleSignUp(input) : undefined}
                  onSignIn={() => {
                    setError(null)
                    setStep(email.trim() ? "password" : "start")
                  }}
                />
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

function AppleMark() {
  const colors = useReswellColors()
  return (
    <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", width: 18, textAlign: "center" }}>
      {"\uF8FF"}
    </Text>
  )
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
  scroll: { flex: 1 },
  scrollBody: {
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
  titleCompact: {
    marginBottom: 8,
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
