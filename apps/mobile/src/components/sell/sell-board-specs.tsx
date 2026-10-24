import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellCollapsibleSection } from "@/components/sell/sell-collapsible-section"
import { SellField, SellSelectField, SellSwitchField } from "@/components/sell/sell-field"
import type { MobileSellBoardSpecs, MobileSellSpecField } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function findBoardSpecField(
  specs: MobileSellBoardSpecs,
  fieldId: string,
): MobileSellSpecField | undefined {
  return specs.sections.flatMap((section) => section.fields).find((field) => field.id === fieldId)
}

export function SellBoardSpecs({
  specs,
  values,
  error,
  onRetry,
  onChange,
  onOpenPicker,
}: {
  specs: MobileSellBoardSpecs | null
  values: Record<string, string>
  error: string | null
  onRetry: () => void
  onChange: (specs: Record<string, string>) => void
  onOpenPicker?: (fieldId: string, decimals: boolean) => void
}) {
  const colors = useReswellColors()
  const [decimals, setDecimals] = useState(false)

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

  const dimensions = specs.sections.find((section) => section.id === "dimensions")
  const facets = specs.sections.find((section) => section.id === "facets")
  const dimensionFields = dimensions?.fields ?? []
  const facetFields = facets?.fields ?? []

  const dimensionsFilled = dimensionFields.some((field) => fieldHasValue(field, values[field.id] ?? ""))
  const facetsFilled = facetFields.some((field) => fieldHasValue(field, values[field.id] ?? ""))
  const lengthField = dimensionFields.find((field) => field.id === "length")
  const lengthFilled = lengthField ? fieldHasValue(lengthField, values.length ?? "") : false

  return (
    <View style={styles.stack}>
      <Text style={[styles.lead, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Tap Dimensions to add length (required for search), size, and volume. Fins & construction are optional.
      </Text>

      {dimensionFields.length > 0 ? (
        <SellCollapsibleSection
          title="Dimensions"
          subtitle={
            dimensionsFilled
              ? dimensionsSummary(dimensionFields, values, decimals)
              : "Length, width, thickness & volume"
          }
          defaultExpanded={!lengthFilled}
        >
          <View style={styles.fields}>
            {dimensionFields.map((field) => (
              <View key={field.id}>
                {field.id === "volume" ? (
                  <SellSwitchField label="Use decimal inches" value={decimals} onValueChange={setDecimals} />
                ) : null}
                <SpecField
                  field={field}
                  values={values}
                  decimals={decimals}
                  onChange={onChange}
                  onOpenPicker={onOpenPicker}
                />
              </View>
            ))}
          </View>
        </SellCollapsibleSection>
      ) : null}

      {facetFields.length > 0 ? (
        <SellCollapsibleSection
          title={facets?.title ?? "Fins & construction"}
          subtitle={
            facetsFilled
              ? facetsSummary(facetFields, values, decimals)
              : (facets?.hint ?? "Fin setup, system, construction & more")
          }
          defaultExpanded={facetsFilled}
        >
          <View style={styles.fields}>
            {facetFields.map((field) => (
              <SpecField
                key={field.id}
                field={field}
                values={values}
                decimals={decimals}
                onChange={onChange}
                onOpenPicker={onOpenPicker}
              />
            ))}
          </View>
        </SellCollapsibleSection>
      ) : null}
    </View>
  )
}

function SpecField({
  field,
  values,
  decimals,
  onChange,
  onOpenPicker,
}: {
  field: MobileSellSpecField
  values: Record<string, string>
  decimals: boolean
  onChange: (specs: Record<string, string>) => void
  onOpenPicker?: (fieldId: string, decimals: boolean) => void
}) {
  if (field.kind === "text") {
    return (
      <SellField
        label={field.label}
        required={field.required}
        value={values[field.id] ?? ""}
        onChangeText={(next) => onChange({ ...values, [field.id]: next })}
        placeholder={field.placeholder ?? undefined}
        keyboardType="decimal-pad"
        autoCapitalize="none"
        suffix={field.suffix ?? undefined}
      />
    )
  }
  return (
    <SellSelectField
      label={field.label}
      required={field.required}
      value={selectDisplay(field, values[field.id] ?? "", decimals)}
      placeholder={field.placeholder ?? "Not specified"}
      onPress={() => onOpenPicker?.(field.id, decimals)}
    />
  )
}

function dimensionsSummary(fields: MobileSellSpecField[], values: Record<string, string>, decimals: boolean): string {
  const parts = fields
    .map((field) => fieldDisplay(field, values[field.id] ?? "", decimals))
    .filter((part) => part !== "")
  if (parts.length === 0) return "Length, width, thickness & volume"
  const sizeParts = parts.filter((part) => !part.endsWith(" L"))
  const volumePart = parts.find((part) => part.endsWith(" L"))
  const sizeLine = sizeParts.join(" × ")
  if (sizeLine && volumePart) return `${sizeLine} · ${volumePart}`
  return parts.join(" · ")
}

function facetsSummary(fields: MobileSellSpecField[], values: Record<string, string>, decimals: boolean): string {
  const parts = fields
    .map((field) => fieldDisplay(field, values[field.id] ?? "", decimals))
    .filter((part) => part !== "")
  if (parts.length === 0) return "Fin setup, system, construction & more"
  if (parts.length <= 2) return parts.join(" · ")
  return `${parts[0]} · +${parts.length - 1} more`
}

function fieldDisplay(field: MobileSellSpecField, raw: string, decimals: boolean): string {
  if (!fieldHasValue(field, raw)) return ""
  if (field.kind === "text") {
    const suffix = field.suffix ? ` ${field.suffix}` : ""
    return `${raw.trim()}${suffix}`
  }
  const option = field.options.find((item) => item.value === raw)
  if (!option || option.value === "") return ""
  return decimals && option.decimal_label ? option.decimal_label : option.label
}

function selectDisplay(field: MobileSellSpecField, raw: string, decimals: boolean): string {
  return fieldDisplay(field, raw, decimals)
}

function fieldHasValue(field: MobileSellSpecField, raw: string): boolean {
  const value = raw.trim()
  if (!value) return false
  if (field.kind === "select") return value !== ""
  return true
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  lead: { fontSize: 14, lineHeight: 20 },
  fields: { gap: 12 },
  note: { fontSize: 14, lineHeight: 20 },
})
