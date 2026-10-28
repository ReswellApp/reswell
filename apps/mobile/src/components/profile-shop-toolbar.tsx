import { SymbolView } from "expo-symbols"
import { ScrollView, StyleSheet, TextInput, View } from "react-native"
import type { MobileProfileShopSection } from "@reswell/api-contract"
import { ProfileShopDropdownPill } from "@/components/profile-shop-dropdown-pill"
import {
  PROFILE_SHOP_SORT_OPTIONS,
  profileShopSortPillLabel,
  type ProfileShopSort,
} from "@/lib/profile-shop-sort"
import { fontFamily, useReswellColors } from "@/theme"

export function ProfileShopToolbar({
  sellerName,
  query,
  onQueryChange,
  sections,
  sectionId,
  onSectionChange,
  sort,
  onSortChange,
}: {
  sellerName: string
  query: string
  onQueryChange: (value: string) => void
  sections?: MobileProfileShopSection[]
  sectionId?: string | null
  onSectionChange?: (sectionId: string | null) => void
  sort: ProfileShopSort
  onSortChange: (sort: ProfileShopSort) => void
}) {
  const colors = useReswellColors()
  const placeholder = `Search ${sellerName.split(/\s+/)[0] ?? "seller"}'s shop…`
  const categoryOptions = [
    { id: null, label: "All categories" },
    ...(sections ?? []).map((section) => ({ id: section.id, label: section.label })),
  ]
  const activeSection = sections?.find((section) => section.id === sectionId)
  const categoryLabel = activeSection?.label ?? "Category"
  const sortOptions = PROFILE_SHOP_SORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={16} tintColor={colors.muted} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {sections && sections.length > 0 && onSectionChange ? (
          <ProfileShopDropdownPill
            label={categoryLabel}
            accessibilityLabel="Filter by category"
            emphasized={sectionId != null}
            options={categoryOptions}
            value={sectionId ?? null}
            onChange={onSectionChange}
          />
        ) : null}
        <ProfileShopDropdownPill
          label={profileShopSortPillLabel(sort)}
          accessibilityLabel="Sort listings"
          options={sortOptions}
          value={sort}
          onChange={(id) => {
            if (id && PROFILE_SHOP_SORT_OPTIONS.some((option) => option.id === id)) {
              onSortChange(id as ProfileShopSort)
            }
          }}
        />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
})
