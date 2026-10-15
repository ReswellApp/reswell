import { savedSearchCardCopy } from "@reswell/api-contract"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { setSavedSearch } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export function SaveSearchCard({
  query,
  accessToken,
  savedSearchId,
  onSignIn,
  onChange,
}: {
  query: string
  accessToken: string | null
  savedSearchId: string | null
  onSignIn: () => void
  onChange: (savedSearchId: string | null) => void
}) {
  const colors = useReswellColors()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saved = Boolean(savedSearchId)
  const copy = savedSearchCardCopy({ saved, compact: true, noun: "listing" })

  function toggle() {
    if (!accessToken) {
      onSignIn()
      return
    }
    setPending(true)
    setError(null)
    setSavedSearch(accessToken, query, !saved)
      .then((result) => onChange(result.saved_search_id))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to update this saved search")
      })
      .finally(() => setPending(false))
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.image }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: colors.foreground, fontFamily: fontFamily.text }]}>{copy.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: saved, disabled: pending }}
        disabled={pending}
        onPress={toggle}
        style={[styles.button, { backgroundColor: colors.background, borderColor: colors.foreground }]}
      >
        {pending ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <SymbolView
            name={{ ios: saved ? "heart.fill" : "heart", android: saved ? "favorite" : "favorite_border", web: "favorite" }}
            size={14}
            tintColor={colors.foreground}
          />
        )}
        <Text style={[styles.buttonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {pending ? (saved ? "Removing…" : "Saving…") : copy.button}
        </Text>
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 24,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    gap: 12,
  },
  copy: { alignItems: "center", gap: 2 },
  title: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 12, lineHeight: 16, textAlign: "center", opacity: 0.8 },
  button: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buttonLabel: { fontSize: 14, fontWeight: "500" },
  error: { fontSize: 12, textAlign: "center" },
})
