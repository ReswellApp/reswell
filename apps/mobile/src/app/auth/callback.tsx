import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { finishOAuthReturnUrl } from "@/lib/google-sign-in"
import { getSupabase } from "@/lib/supabase"
import { fontFamily, useReswellColors } from "@/theme"

/** Handles `reswell://auth/callback?code=…` when the app opens from the browser. */
export default function AuthCallbackScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setError("Supabase is not configured in this build.")
      return
    }

    if (params.error_description || params.error) {
      setError(String(params.error_description ?? params.error))
      return
    }

    const code = typeof params.code === "string" ? params.code : null
    if (!code) {
      setError("Sign-in callback did not include an authorization code.")
      return
    }

    let active = true
    void finishOAuthReturnUrl(supabase, `reswell://auth/callback?code=${encodeURIComponent(code)}`).then(
      (message) => {
        if (!active) return
        if (message) {
          setError(message)
          return
        }
        router.replace("/")
      },
    )
    return () => {
      active = false
    }
  }, [params.code, params.error, params.error_description, router])

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: fontFamily.text, textAlign: "center" }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  )
}
