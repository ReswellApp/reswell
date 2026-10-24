import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellField, SellSelectField } from "@/components/sell/sell-field"
import { SellOptionSheet } from "@/components/sell/sell-option-sheet"
import { useSellCatalogSuggest } from "@/components/sell/use-sell-catalog-suggest"
import type { SellDraft } from "@/lib/sell-flow"
import type { MobileSellCatalogRow, MobileSellTaxonomy } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellProductStep({
  draft,
  taxonomy,
  error,
  onRetry,
  onChange,
  conditionLabel,
  onConditionPress,
  variant = "all",
}: {
  draft: SellDraft
  taxonomy: MobileSellTaxonomy | null
  error: string | null
  onRetry: () => void
  onChange: (patch: Partial<SellDraft>) => void
  conditionLabel?: string | null
  onConditionPress?: () => void
  /** `identity` = title, brand, model. `classification` = category, condition. */
  variant?: "all" | "identity" | "classification"
}) {
  const colors = useReswellColors()
  const [sheet, setSheet] = useState<"category" | "subcategory" | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const suggestions = useSellCatalogSuggest(suggesting ? draft.brand : "")
  const category = taxonomy?.categories.find((item) => item.slug === draft.category) ?? null
  const subcategory = category?.subcategories.find((item) => item.slug === draft.subcategory) ?? null

  function applySuggestion(row: MobileSellCatalogRow) {
    const title = draft.title.trim() || (row.model_name ? row.title : "")
    onChange({
      brand: row.brand_name,
      model: row.kind === "brand" ? draft.model : (row.model_name ?? ""),
      category: row.category,
      subcategory: row.board_type ?? (row.category === draft.category ? draft.subcategory : ""),
      title,
    })
    setSuggesting(false)
  }

  function selectCategory(slug: string) {
    const next = taxonomy?.categories.find((item) => item.slug === slug)
    const keepSubcategory = next?.subcategories.some((item) => item.slug === draft.subcategory) ?? false
    onChange({ category: slug, subcategory: keepSubcategory ? draft.subcategory : "" })
    if (next && next.subcategories.length > 0) {
      setSheet("subcategory")
      return
    }
    setSheet(null)
  }

  const showIdentity = variant === "all" || variant === "identity"
  const showClassification = variant === "all" || variant === "classification"

  if (showClassification && error) {
    return (
      <View style={styles.stack}>
        <Text style={[styles.copy, { color: colors.foreground, fontFamily: fontFamily.text }]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  if (showClassification && !taxonomy) {
    return <Text style={[styles.copy, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading categories…</Text>
  }

  return (
    <View style={styles.stack}>
      {showIdentity ? (
        <>
          <SellField
            label="Listing title"
            required
            value={draft.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="Album Ghost 5'8"
            autoCapitalize="words"
          />
          <SellField
            label="Brand"
            required
            value={draft.brand}
            onChangeText={(brand) => {
              setSuggesting(true)
              onChange({ brand })
            }}
            onFocus={() => setSuggesting(true)}
            placeholder="Album"
            autoCapitalize="words"
          />
          {suggesting && suggestions.results.length > 0 ? (
            <View style={[styles.suggestions, { borderColor: colors.foreground }]}>
              {suggestions.results.map((row) => (
                <Pressable
                  key={`${row.kind}-${row.id}`}
                  accessibilityRole="button"
                  onPress={() => applySuggestion(row)}
                  style={[styles.suggestion, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.suggestionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {row.title}
                  </Text>
                  <Text style={[styles.suggestionMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {row.category_label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <SellField
            label="Model"
            required
            value={draft.model}
            onChangeText={(model) => onChange({ model })}
            onFocus={() => setSuggesting(false)}
            placeholder="Ghost"
            autoCapitalize="words"
          />
        </>
      ) : null}
      {showClassification && taxonomy ? (
        <>
      <SellSelectField
        label="Category"
        required
        value={category?.label ?? ""}
        placeholder="Select one..."
        onPress={() => setSheet("category")}
      />
      {category && category.subcategories.length > 0 ? (
        <SellSelectField
          label={category.subcategory_label ?? "Subcategory"}
          required
          value={subcategory?.label ?? ""}
          placeholder="Select one..."
          onPress={() => setSheet("subcategory")}
        />
      ) : null}
      {onConditionPress ? (
        <SellSelectField
          label="Condition"
          required
          value={conditionLabel ?? ""}
          placeholder="Select one..."
          onPress={onConditionPress}
        />
      ) : null}
      {sheet === "category" ? (
        <SellOptionSheet
          title="Category"
          selected={draft.category}
          options={taxonomy.categories.map((item) => ({ value: item.slug, label: item.label }))}
          onSelect={selectCategory}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "subcategory" && category ? (
        <SellOptionSheet
          title={category.subcategory_label ?? "Subcategory"}
          selected={draft.subcategory}
          options={category.subcategories.map((item) => ({ value: item.slug, label: item.label }))}
          onSelect={(slug) => {
            onChange({ subcategory: slug })
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  copy: { fontSize: 16 },
  retry: { fontSize: 16, fontWeight: "600" },
  suggestions: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginTop: -8 },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionTitle: { fontSize: 16, fontWeight: "600" },
  suggestionMeta: { fontSize: 13 },
})
