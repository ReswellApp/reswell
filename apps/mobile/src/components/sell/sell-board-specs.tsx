import { useState } from "react"
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { SellOptionSheet } from "@/components/sell/sell-option-sheet"
import type { MobileSellBoardSpecs, MobileSellSpecField } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellBoardSpecs({
  specs,
  values,
  error,
  onRetry,
  onChange,
}: {
  specs: MobileSellBoardSpecs | null
  values: Record<string, string>
  error: string | null
  onRetry: () => void
  onChange: (specs: Record<string, string>) => void
}) {
  const colors = useReswellColors()
  const [decimals, setDecimals] = useState(false)
  const [openFieldId, setOpenFieldId] = useState<string | null>(null)

  if (error) {
    return (
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={[styles.note, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>{error} Retry</Text>
      </Pressable>
    )
  }

  if (!specs) {
    return (
      <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading board details…</Text>
    )
  }

  const openField = specs.sections.flatMap((section) => section.fields).find((field) => field.id === openFieldId) ?? null
  let decimalsPlaced = false

  return (
    <View style={styles.stack}>
      {specs.sections.map((section) => {
        const hasDecimals = section.fields.some((field) => field.options.some((option) => option.decimal_label))
        const showDecimals = hasDecimals && !decimalsPlaced
        if (showDecimals) decimalsPlaced = true
        return (
          <View key={section.id} style={styles.section}>
            {section.title ? (
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {section.title}
              </Text>
            ) : null}
            {section.hint ? (
              <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{section.hint}</Text>
            ) : null}
            <View style={styles.grid}>
              {section.fields.map((field) => (
                <View key={field.id} style={styles.cell}>
                  {field.kind === "text" ? (
                    <TextSpec
                      field={field}
                      value={values[field.id] ?? ""}
                      onChangeText={(next) => onChange({ ...values, [field.id]: next })}
                    />
                  ) : (
                    <SelectSpec
                      field={field}
                      value={values[field.id] ?? ""}
                      decimals={decimals}
                      onPress={() => setOpenFieldId(field.id)}
                    />
                  )}
                </View>
              ))}
            </View>
            {showDecimals ? (
              <View style={styles.decimals}>
                <Text style={[styles.decimalsLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>Decimals</Text>
                <Switch
                  accessibilityLabel="Decimals"
                  value={decimals}
                  onValueChange={setDecimals}
                  trackColor={{ false: colors.border, true: colors.listingHeart }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={colors.border}
                />
              </View>
            ) : null}
          </View>
        )
      })}
      {openField && openField.kind === "select" ? (
        <SellOptionSheet
          title={openField.label}
          options={openField.options.map((option) => ({
            value: option.value,
            label: decimals && option.decimal_label ? option.decimal_label : option.label,
          }))}
          selected={values[openField.id] ?? ""}
          onSelect={(value) => {
            onChange({ ...values, [openField.id]: value })
            setOpenFieldId(null)
          }}
          onClose={() => setOpenFieldId(null)}
        />
      ) : null}
    </View>
  )
}

function SelectSpec({
  field,
  value,
  decimals,
  onPress,
}: {
  field: MobileSellSpecField
  value: string
  decimals: boolean
  onPress: () => void
}) {
  const colors = useReswellColors()
  const option = field.options.find((item) => item.value === value)
  const label = option ? (decimals && option.decimal_label ? option.decimal_label : option.label) : (field.placeholder ?? "—")
  const empty = !option || option.value === ""

  return (
    <View style={styles.field}>
      <FieldLabel label={field.label} required={field.required} />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.control, { borderColor: colors.border, backgroundColor: colors.background }]}
      >
        <Text
          numberOfLines={1}
          style={[styles.controlLabel, { color: empty ? colors.muted : colors.foreground, fontFamily: fontFamily.text }]}
        >
          {label}
        </Text>
        <Text style={[styles.chevron, { color: colors.muted }]}>▾</Text>
      </Pressable>
      {field.hint ? (
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{field.hint}</Text>
      ) : null}
    </View>
  )
}

function TextSpec({
  field,
  value,
  onChangeText,
}: {
  field: MobileSellSpecField
  value: string
  onChangeText: (value: string) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.field}>
      <FieldLabel label={field.label} required={field.required} />
      <View style={[styles.control, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={field.placeholder ?? ""}
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
        />
        {field.suffix ? (
          <Text style={[styles.suffix, { color: colors.muted, fontFamily: fontFamily.text }]}>{field.suffix}</Text>
        ) : null}
      </View>
    </View>
  )
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  const colors = useReswellColors()
  return (
    <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
      {label}
      {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
    </Text>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 18, marginTop: 8 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "48%", flexGrow: 1 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  control: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  controlLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  chevron: { fontSize: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  suffix: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 12, lineHeight: 16 },
  decimals: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  decimalsLabel: { fontSize: 14, fontWeight: "600" },
})
