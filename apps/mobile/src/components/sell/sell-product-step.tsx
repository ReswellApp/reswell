import { useCallback, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellCatalogSuggestField } from "@/components/sell/sell-catalog-suggest-field"
import { SellField, SellSelectField } from "@/components/sell/sell-field"
import { SellOptionSheet } from "@/components/sell/sell-option-sheet"
import { useSellBrandModels } from "@/components/sell/use-sell-brand-models"
import { useSellCatalogSuggest } from "@/components/sell/use-sell-catalog-suggest"
import type { SellDraft } from "@/lib/sell-flow"
import type { MobileSellCatalogRow, MobileSellTaxonomy } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

type SuggestField = "brand" | "model"

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
  /** `identity` = brand, model, title. `classification` = category, condition. */
  variant?: "all" | "identity" | "classification"
}) {
  const colors = useReswellColors()
  const [sheet, setSheet] = useState<"category" | "subcategory" | null>(null)
  const [suggest, setSuggest] = useState<SuggestField | null>(null)
  const locked = useRef({ brand: false, model: false })
  const brandSuggestions = useSellCatalogSuggest(draft.brand)
  const modelSuggestions = useSellBrandModels(draft.brandId, draft.model)
  const category = taxonomy?.categories.find((item) => item.slug === draft.category) ?? null
  const subcategory = category?.subcategories.find((item) => item.slug === draft.subcategory) ?? null
  const catalogBrand = draft.brandId.trim().length > 0

  const openSuggest = useCallback((field: SuggestField) => {
    locked.current[field] = false
    setSuggest(field)
  }, [])

  const closeSuggest = useCallback((field: SuggestField) => {
    setSuggest((current) => (current === field ? null : current))
  }, [])

  const keepTyped = useCallback((field: SuggestField) => {
    locked.current[field] = true
    setSuggest((current) => (current === field ? null : current))
  }, [])

  function applyCatalogSuggestion(row: MobileSellCatalogRow) {
    if (row.kind !== "brand") return
    onChange({
      brand: row.brand_name,
      brandId: row.brand_id,
      brandModelId: "",
      linkedBrandName: row.brand_name,
      model: "",
      category: row.category,
      subcategory: row.category === draft.category ? draft.subcategory : "",
    })
    locked.current.brand = false
    locked.current.model = false
    setSuggest(null)
  }

  function applyBrandModel(row: MobileSellCatalogRow) {
    if (row.kind !== "model") return
    onChange({
      brand: row.brand_name,
      brandId: row.brand_id,
      brandModelId: row.id,
      linkedBrandName: row.brand_name,
      model: row.model_name ?? "",
      category: row.category,
      subcategory: row.board_type ?? (row.category === draft.category ? draft.subcategory : ""),
    })
    locked.current.model = false
    setSuggest(null)
  }

  function onBrandChange(brand: string) {
    if (!locked.current.brand) setSuggest("brand")
    const linked = draft.linkedBrandName.trim()
    const clearLink = Boolean(draft.brandId && linked && brand.trim() !== linked)
    if (!clearLink) {
      onChange({ brand })
      return
    }
    locked.current.model = false
    onChange({
      brand,
      brandId: "",
      brandModelId: "",
      linkedBrandName: "",
      model: "",
    })
  }

  function onModelChange(model: string) {
    if (catalogBrand && !locked.current.model) setSuggest("model")
    const clearCatalogModel = Boolean(draft.brandModelId) && model.trim() !== draft.model.trim()
    onChange({
      model,
      brandModelId: clearCatalogModel ? "" : draft.brandModelId,
    })
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
          <SellCatalogSuggestField
            label="Brand"
            required
            value={draft.brand}
            onChangeText={onBrandChange}
            placeholder="Album"
            open={suggest === "brand"}
            onOpen={() => openSuggest("brand")}
            onClose={() => closeSuggest("brand")}
            onKeepTyped={() => keepTyped("brand")}
            rows={brandSuggestions.results}
            loading={brandSuggestions.searching}
            onPick={applyCatalogSuggestion}
            listLabel="Brand matches"
          />
          {catalogBrand ? (
            <SellCatalogSuggestField
              label="Model"
              required
              value={draft.model}
              onChangeText={onModelChange}
              placeholder="Ghost"
              open={suggest === "model"}
              onOpen={() => openSuggest("model")}
              onClose={() => closeSuggest("model")}
              onKeepTyped={() => keepTyped("model")}
              rows={modelSuggestions.results}
              loading={modelSuggestions.loading}
              onPick={applyBrandModel}
              listLabel="Model matches"
              allowEmptyQuery
            />
          ) : (
            <SellField
              label="Model"
              required
              value={draft.model}
              onChangeText={onModelChange}
              placeholder="Ghost"
              autoCapitalize="words"
              autoCorrect={false}
            />
          )}
          <SellField
            label="Listing title"
            required
            value={draft.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="6'0 Album Ghost"
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
})
