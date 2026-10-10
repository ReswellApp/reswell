import { StyleSheet, Text, TextInput, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

export function SellField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize = "sentences",
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: "default" | "decimal-pad"
  autoCapitalize?: "none" | "sentences" | "words" | "characters"
}) {
  const colors = useReswellColors()

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize !== "characters"}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
})
