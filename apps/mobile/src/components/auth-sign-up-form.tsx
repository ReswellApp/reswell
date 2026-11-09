import { SymbolView } from "expo-symbols"
import { useEffect, useState, type ReactNode } from "react"
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { AppleSignUpInput, GoogleSignUpInput, SignUpInput } from "@/lib/auth-context"
import { publicSiteUrl } from "@/lib/public-env"
import { fontFamily, useReswellColors } from "@/theme"

const PASSWORD_HINT = "12+ chars, upper, lower, number, and special character."

type AuthSignUpFormProps = {
  email: string
  onEmailChange: (email: string) => void
  busy: boolean
  error: string | null
  onSubmit: (input: SignUpInput) => void
  onGoogle: (input: GoogleSignUpInput) => void
  onApple?: (input: AppleSignUpInput) => void
  onSignIn: () => void
}

export function AuthSignUpForm({
  email,
  onEmailChange,
  busy,
  error,
  onSubmit,
  onGoogle,
  onApple,
  onSignIn,
}: AuthSignUpFormProps) {
  const colors = useReswellColors()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [googlePending, setGooglePending] = useState(false)
  const [applePending, setApplePending] = useState(false)
  const [errorAnchor, setErrorAnchor] = useState<"google" | "apple" | "form">("form")

  useEffect(() => {
    if (!busy) {
      setGooglePending(false)
      setApplePending(false)
    }
  }, [busy])

  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const ready =
    emailReady && firstName.trim().length > 0 && lastName.trim().length > 0 && password.length > 0 && !busy
  const shownError = localError ?? error

  function submit() {
    if (!acceptedTerms) {
      setLocalError("Please accept Reswell's Terms of Use and Privacy Policy to continue.")
      return
    }
    const problem = passwordProblem(password)
    if (problem) {
      setLocalError(problem)
      return
    }
    setLocalError(null)
    setErrorAnchor("form")
    setGooglePending(false)
    onSubmit({
      email,
      password,
      firstName,
      lastName,
      username,
      marketingOptIn,
      acceptedTerms,
    })
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Already have an account?{" "}
        <Text style={[styles.inlineLink, { color: colors.foreground }]} onPress={onSignIn}>
          Sign in
        </Text>
      </Text>

      {onApple ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy || applePending}
          onPress={() => {
            if (!acceptedTerms) {
              setErrorAnchor("apple")
              setLocalError("Please accept Reswell's Terms of Use and Privacy Policy to continue.")
              return
            }
            setLocalError(null)
            setErrorAnchor("apple")
            setApplePending(true)
            onApple({ marketingOptIn, acceptedTerms })
          }}
          style={[styles.social, { borderColor: "#E4E4E7", backgroundColor: colors.background }]}
        >
          {applePending ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", width: 18, textAlign: "center" }}>
                {"\uF8FF"}
              </Text>
              <Text style={[styles.socialLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Sign up with Apple
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {errorAnchor === "apple" && shownError ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{shownError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy || googlePending}
        onPress={() => {
          if (!acceptedTerms) {
            setErrorAnchor("google")
            setLocalError("Please accept Reswell's Terms of Use and Privacy Policy to continue.")
            return
          }
          setLocalError(null)
          setErrorAnchor("google")
          setGooglePending(true)
          onGoogle({ marketingOptIn, acceptedTerms })
        }}
        style={[styles.social, { borderColor: "#E4E4E7", backgroundColor: colors.background }]}
      >
        {googlePending ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <>
            <View style={styles.googleWrap}>
              <Text style={styles.googleLetter}>G</Text>
            </View>
            <Text style={[styles.socialLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              Sign up with Google
            </Text>
          </>
        )}
      </Pressable>

      {errorAnchor === "google" && shownError ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{shownError}</Text>
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={[styles.or, { color: colors.muted, fontFamily: fontFamily.text }]}>or</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.nameRow}>
        <View style={styles.nameField}>
          <Field label="First name">
            <TextInput
              autoComplete="given-name"
              placeholder="First name"
              placeholderTextColor="#A3A3A3"
              value={firstName}
              onChangeText={(value) => {
                setLocalError(null)
                setFirstName(value)
              }}
              style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
            />
          </Field>
        </View>
        <View style={styles.nameField}>
          <Field label="Last name">
            <TextInput
              autoComplete="family-name"
              placeholder="Last name"
              placeholderTextColor="#A3A3A3"
              value={lastName}
              onChangeText={(value) => {
                setLocalError(null)
                setLastName(value)
              }}
              style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
            />
          </Field>
        </View>
      </View>

      <Field label="Username" hint="(optional)">
        <TextInput
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect={false}
          placeholder="Choose a public username"
          placeholderTextColor="#A3A3A3"
          value={username}
          onChangeText={(value) => {
            setLocalError(null)
            setUsername(value)
          }}
          style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
        />
      </Field>

      <Field label="Email">
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Enter email address"
          placeholderTextColor="#A3A3A3"
          value={email}
          onChangeText={(value) => {
            setLocalError(null)
            onEmailChange(value)
          }}
          style={[styles.input, { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text }]}
        />
      </Field>

      <Field label="Password">
        <View>
          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            secureTextEntry={!showPassword}
            placeholder="Password"
            placeholderTextColor="#A3A3A3"
            value={password}
            onChangeText={(value) => {
              setLocalError(null)
              setPassword(value)
            }}
            style={[
              styles.input,
              styles.passwordInput,
              { color: colors.foreground, borderColor: "#E6E6E6", fontFamily: fontFamily.text },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            onPress={() => setShowPassword((current) => !current)}
            style={styles.eye}
          >
            <SymbolView
              name={{
                ios: showPassword ? "eye.slash" : "eye",
                android: showPassword ? "visibility_off" : "visibility",
                web: showPassword ? "visibility_off" : "visibility",
              }}
              size={18}
              tintColor={colors.muted}
            />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{PASSWORD_HINT}</Text>
      </Field>

      <ConsentRow checked={marketingOptIn} onPress={() => setMarketingOptIn((current) => !current)}>
        <Text style={[styles.consentText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Get the latest news and promotions via email
        </Text>
      </ConsentRow>

      <ConsentRow
        checked={acceptedTerms}
        labelToggles={false}
        onPress={() => {
          setLocalError(null)
          setAcceptedTerms((current) => !current)
        }}
      >
        <Text style={[styles.consentText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          By tapping Sign up, I agree to Reswell's{" "}
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(`${publicSiteUrl()}/terms`)}>
            Terms of Use
          </Text>{" "}
          and{" "}
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(`${publicSiteUrl()}/privacy`)}>
            Privacy Policy
          </Text>
          .
        </Text>
      </ConsentRow>

      {errorAnchor === "form" && shownError ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{shownError}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={!ready}
        onPress={submit}
        style={[styles.primary, { backgroundColor: ready || busy ? colors.foreground : "#ECECEF" }]}
      >
        {busy && !googlePending ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text
            style={[styles.primaryLabel, { color: ready ? colors.background : "#C8C8CC", fontFamily: fontFamily.text }]}
          >
            Sign up
          </Text>
        )}
      </Pressable>
    </View>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const colors = useReswellColors()
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {label}
        {hint ? <Text style={styles.optional}> {hint}</Text> : null}
      </Text>
      {children}
    </View>
  )
}

function ConsentRow({
  checked,
  onPress,
  labelToggles = true,
  children,
}: {
  checked: boolean
  onPress: () => void
  labelToggles?: boolean
  children: ReactNode
}) {
  const colors = useReswellColors()
  const box = (
    <View
      style={[
        styles.box,
        {
          borderColor: checked ? colors.foreground : "#E6E6E6",
          backgroundColor: checked ? colors.foreground : colors.background,
        },
      ]}
    >
      {checked ? (
        <SymbolView
          name={{ ios: "checkmark", android: "check", web: "check" }}
          size={12}
          tintColor={colors.background}
        />
      ) : null}
    </View>
  )
  return (
    <View style={styles.consent}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} hitSlop={8}>
        {box}
      </Pressable>
      {labelToggles ? (
        <Pressable onPress={onPress} style={styles.consentCopy}>
          {children}
        </Pressable>
      ) : (
        <View style={styles.consentCopy}>{children}</View>
      )}
    </View>
  )
}

function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters."
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter."
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter."
  if (!/[0-9]/.test(password)) return "Password must include at least one number."
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include at least one special character."
  return null
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  subtitle: { fontSize: 14, textAlign: "center" },
  inlineLink: { fontWeight: "600", textDecorationLine: "underline" },
  nameRow: { flexDirection: "row", gap: 12 },
  field: { gap: 4 },
  nameField: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: "500" },
  optional: { fontWeight: "400" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  passwordInput: { paddingRight: 48 },
  eye: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, lineHeight: 16 },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  consentCopy: { flex: 1 },
  consentText: { fontSize: 13, lineHeight: 18 },
  legalLink: { textDecorationLine: "underline" },
  error: { fontSize: 14, textAlign: "center" },
  primary: {
    minHeight: 44,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryLabel: { fontSize: 17, fontWeight: "600" },
  social: {
    minHeight: 44,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialLabel: { fontSize: 16, fontWeight: "600" },
  googleWrap: { width: 20, alignItems: "center" },
  googleLetter: { fontSize: 18, fontWeight: "700", color: "#4285F4" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 14 },
})
