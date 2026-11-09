import { Image } from "expo-image"
import { useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { saleLabelImageUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

export default function SaleLabelScreen() {
  const colors = useReswellColors()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const token = session?.access_token ?? null
  const uri = id ? `${saleLabelImageUrl(id)}?r=${attempt}` : null

  return (
    <AccountState
      title="Shipping label"
      loading={!uri || !token}
      error={token ? null : "Sign in required"}
      onRetry={() => setAttempt((current) => current + 1)}
      empty="No shipping label for this order."
      isEmpty={!uri}
      searchHeader={false}
      edgeToEdgeBottom
    >
      {uri && token && !failed ? (
        <Image
          source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
          style={[styles.image, { backgroundColor: colors.background }]}
          contentFit="contain"
          accessibilityLabel="Shipping label"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.center}>
          {failed ? (
            <>
              <Text style={[styles.message, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Unable to display this shipping label.
              </Text>
              <Pressable
                onPress={() => {
                  setFailed(false)
                  setAttempt((current) => current + 1)
                }}
              >
                <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.foreground} />
          )}
        </View>
      )}
    </AccountState>
  )
}

const styles = StyleSheet.create({
  image: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  retry: { fontSize: 16, fontWeight: "600" },
})
