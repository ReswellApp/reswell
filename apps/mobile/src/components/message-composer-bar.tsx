import { SymbolView } from "expo-symbols"
import type { ReactNode } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

/** Rounded input shell + send control — shared by marketplace messages and Reswell help threads. */
export function MessageComposerBar({
  draft,
  onChangeText,
  onSend,
  sending = false,
  placeholder,
  paddingBottom,
  leading,
  sendDisabled,
  error,
}: {
  draft: string
  onChangeText: (value: string) => void
  onSend: () => void
  sending?: boolean
  placeholder: string
  paddingBottom: number
  leading?: ReactNode
  sendDisabled?: boolean
  error?: string | null
}) {
  const colors = useReswellColors()
  const canSend = draft.trim().length > 0 && !sending && !sendDisabled

  return (
    <>
      <View style={[styles.composer, { paddingBottom }]}>
        <View style={[styles.inputShell, { borderColor: colors.border }]}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <TextInput
            value={draft}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            editable={!sending}
            style={[
              styles.input,
              leading ? null : styles.inputNoLeading,
              { color: colors.foreground, fontFamily: fontFamily.text },
            ]}
          />
          <Pressable
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={onSend}
            style={styles.send}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <SymbolView
                name={{ ios: "paperplane.fill", android: "send", web: "send" }}
                size={18}
                tintColor={canSend ? colors.foreground : colors.muted}
              />
            )}
          </Pressable>
        </View>
      </View>
      {error ? (
        <Text style={[styles.sendError, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  composer: { paddingHorizontal: 20, paddingTop: 4 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingLeft: 4,
    paddingRight: 6,
  },
  leading: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, paddingRight: 4, paddingLeft: 6 },
  inputNoLeading: { paddingLeft: 14 },
  send: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  sendError: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 13 },
})
