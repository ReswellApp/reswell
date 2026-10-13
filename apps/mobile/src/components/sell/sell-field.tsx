import { SymbolView } from "expo-symbols"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { fontFamily, useReswellColors } from "@/theme"

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const colors = useReswellColors()
  return (
    <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>
      {label}
      {required ? <Text style={[styles.required, { color: colors.destructive }]}> *</Text> : null}
    </Text>
  )
}

export function SellField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize = "sentences",
  required = false,
  onFocus,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: "default" | "decimal-pad"
  autoCapitalize?: "none" | "sentences" | "words" | "characters"
  required?: boolean
  onFocus?: () => void
}) {
  const colors = useReswellColors()

  return (
    <View style={styles.wrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize !== "characters"}
        onFocus={onFocus}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text },
        ]}
      />
    </View>
  )
}

export function SellSelectField({
  label,
  value,
  placeholder,
  onPress,
  required = false,
}: {
  label: string
  value: string
  placeholder: string
  onPress: () => void
  required?: boolean
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.wrap}>
      <FieldLabel label={label} required={required} />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.input, styles.select, { borderColor: colors.border }]}
      >
        <Text
          style={[
            styles.selectLabel,
            { color: value ? colors.foreground : colors.muted, fontFamily: fontFamily.text },
          ]}
        >
          {value || placeholder}
        </Text>
        <SymbolView
          name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
          size={16}
          tintColor={colors.muted}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: "700" },
  required: { fontWeight: "700" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  selectLabel: { flex: 1, fontSize: 16 },
})
