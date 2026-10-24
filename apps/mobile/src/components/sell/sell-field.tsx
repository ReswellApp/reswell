import { SymbolView } from "expo-symbols"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"
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
  accessibilityLabel,
  suffix,
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
  accessibilityLabel?: string
  suffix?: string
}) {
  const colors = useReswellColors()

  const input = (
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
      accessibilityLabel={accessibilityLabel || label || placeholder || "Text field"}
      style={[
        styles.input,
        multiline ? styles.multiline : null,
        suffix ? styles.inputWithSuffix : null,
        {
          color: colors.foreground,
          borderColor: colors.foreground,
          backgroundColor: colors.background,
          fontFamily: fontFamily.text,
        },
      ]}
    />
  )

  return (
    <View style={styles.wrap}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      {suffix ? (
        <View style={[styles.input, styles.suffixRow, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
          {input}
          <Text style={[styles.suffix, { color: colors.muted, fontFamily: fontFamily.text }]}>{suffix}</Text>
        </View>
      ) : (
        input
      )}
    </View>
  )
}

export function SellSwitchField({
  label,
  value,
  onValueChange,
  trailing,
}: {
  label: string
  value: boolean
  onValueChange: (next: boolean) => void
  trailing?: ReactNode
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.switchWrap}>
      <Pressable accessible={false} onPress={() => onValueChange(!value)} style={styles.switchLabelRow}>
        <Text style={[styles.switchLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
        {trailing}
      </Pressable>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.listingHeart }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.border}
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
        style={[styles.input, styles.select, { borderColor: colors.foreground, backgroundColor: colors.background }]}
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
  wrap: { gap: 4 },
  label: { fontSize: 15, fontWeight: "700" },
  required: { fontWeight: "700" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: { minHeight: 128, textAlignVertical: "top", paddingVertical: 12 },
  inputWithSuffix: { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  suffixRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  suffix: { fontSize: 16, fontWeight: "600" },
  switchWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
  },
  switchLabelRow: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  switchLabel: { flexShrink: 1, fontSize: 16, fontWeight: "500" },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  selectLabel: { flex: 1, fontSize: 16 },
})
