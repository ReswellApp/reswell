import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileCategory } from "@reswell/api-contract"
import {
  CategoryLocationFilter,
  type CategoryLocationHandle,
  type CategoryPlace,
  type CategoryRadius,
} from "@/components/category-location-filter"
import { fontFamily, useReswellColors } from "@/theme"

type FacetGroup = MobileCategory["facets"][number]
type SelectedFacets = Record<string, string[]>
type FilterPage = "root" | "location" | string

type CategoryFiltersProps = {
  visible: boolean
  facets: FacetGroup[]
  ship: boolean
  showLocation: boolean
  shipping: boolean
  selected: SelectedFacets
  place: CategoryPlace | null
  radius: CategoryRadius
  onShippingChange: (shipping: boolean) => void
  onSelectedChange: (selected: SelectedFacets) => void
  onPlaceChange: (place: CategoryPlace | null) => void
  onRadiusChange: (radius: CategoryRadius) => void
  onClear: () => void
  onClose: () => void
}

export function CategoryFilters({
  visible,
  facets,
  ship,
  showLocation,
  shipping,
  selected,
  place,
  radius,
  onShippingChange,
  onSelectedChange,
  onPlaceChange,
  onRadiusChange,
  onClear,
  onClose,
}: CategoryFiltersProps) {
  const colors = useReswellColors()
  const scheme = useColorScheme()
  const insets = useSafeAreaInsets()
  const locationRef = useRef<CategoryLocationHandle>(null)
  const [page, setPage] = useState<FilterPage>("root")
  const [locationKey, setLocationKey] = useState(0)
  const backdrop = scheme === "dark" ? "#1C1C1E" : "#E4E4E9"
  const chrome = scheme === "dark" ? colors.card : "#FFFFFF"
  const activeGroup = facets.find((group) => group.id === page) ?? null
  const condition = facets.find((group) => group.id === "condition")
  const title = page === "root" ? "Filter" : page === "location" ? "Location" : activeGroup?.label ?? "Filter"

  useEffect(() => {
    if (!visible) setPage("root")
  }, [visible])

  function close() {
    locationRef.current?.commit()
    onClose()
  }

  function back() {
    locationRef.current?.commit()
    setPage("root")
  }

  function clearPage() {
    if (page === "root") {
      onClear()
      setLocationKey((key) => key + 1)
      return
    }
    if (page === "location") {
      onPlaceChange(null)
      onRadiusChange("any")
      setLocationKey((key) => key + 1)
      return
    }
    onSelectedChange({ ...selected, [page]: [] })
  }

  function toggleValue(groupId: string, value: string) {
    const values = selected[groupId] ?? []
    const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
    onSelectedChange({ ...selected, [groupId]: next })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={page === "root" ? close : back}>
      <View style={[styles.backdrop, { backgroundColor: backdrop, paddingTop: insets.top + 8 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <FilterHeader
            title={title}
            chrome={chrome}
            borderColor={colors.border}
            foreground={colors.foreground}
            back={page !== "root"}
            onLeading={page === "root" ? close : back}
            onClear={clearPage}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          >
            {page === "root" ? (
              <FilterHome
                facets={facets}
                condition={condition}
                ship={ship}
                showLocation={showLocation}
                shipping={shipping}
                selected={selected}
                place={place}
                radius={radius}
                onOpen={setPage}
                onToggleShipping={() => onShippingChange(!shipping)}
                onToggleCondition={(value) => toggleValue("condition", value)}
              />
            ) : null}
            {activeGroup ? (
              <FacetList
                group={activeGroup}
                selected={selected[activeGroup.id] ?? []}
                onAll={() => onSelectedChange({ ...selected, [activeGroup.id]: [] })}
                onToggle={(value) => toggleValue(activeGroup.id, value)}
              />
            ) : null}
            {page === "location" && showLocation ? (
              <CategoryLocationFilter
                key={locationKey}
                ref={locationRef}
                place={place}
                onPlaceChange={onPlaceChange}
                radius={radius}
                onRadiusChange={onRadiusChange}
              />
            ) : null}
          </ScrollView>
          <View pointerEvents="box-none" style={[styles.resultsWrap, { bottom: insets.bottom + 16 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show results"
              onPress={close}
              style={[styles.results, { backgroundColor: colors.foreground }]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: fontFamily.text, fontSize: 16, fontWeight: "700" }}>
                Show results
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function FilterHome({
  facets,
  condition,
  ship,
  showLocation,
  shipping,
  selected,
  place,
  radius,
  onOpen,
  onToggleShipping,
  onToggleCondition,
}: {
  facets: FacetGroup[]
  condition: FacetGroup | undefined
  ship: boolean
  showLocation: boolean
  shipping: boolean
  selected: SelectedFacets
  place: CategoryPlace | null
  radius: CategoryRadius
  onOpen: (page: FilterPage) => void
  onToggleShipping: () => void
  onToggleCondition: (value: string) => void
}) {
  const colors = useReswellColors()
  const rows = facetRows(facets, showLocation)
  const hasTop = ship || (condition?.options.length ?? 0) > 0

  return (
    <View>
      {hasTop ? (
        <View style={styles.top}>
          <Text style={[styles.topLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Top filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ship ? <ShipToMeChip active={shipping} onPress={onToggleShipping} /> : null}
            {condition?.options.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={selected.condition?.includes(option.value) ?? false}
                onPress={() => onToggleCondition(option.value)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {rows.map((row) =>
        row === "location" ? (
          <FilterLink
            key="location"
            title="Location"
            detail={locationDetail(place, radius)}
            onPress={() => onOpen("location")}
          />
        ) : (
          <FilterLink
            key={row.id}
            title={row.label}
            detail={facetDetail(row, selected[row.id] ?? [])}
            onPress={() => onOpen(row.id)}
          />
        ),
      )}
    </View>
  )
}

function FacetList({
  group,
  selected,
  onAll,
  onToggle,
}: {
  group: FacetGroup
  selected: string[]
  onAll: () => void
  onToggle: (value: string) => void
}) {
  const allSelected = selected.length === 0
  return (
    <View>
      <OptionRow label="All" selected={allSelected} onPress={onAll} />
      {group.options.map((option) => (
        <OptionRow
          key={option.value}
          label={option.label}
          selected={selected.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  )
}

function FilterHeader({
  title,
  chrome,
  borderColor,
  foreground,
  back,
  onLeading,
  onClear,
}: {
  title: string
  chrome: string
  borderColor: string
  foreground: string
  back: boolean
  onLeading: () => void
  onClear: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={back ? "Back" : "Close"}
        onPress={onLeading}
        style={[styles.circle, styles.headerSide, shadow, { backgroundColor: chrome, borderColor }]}
      >
        <SymbolView
          name={
            back
              ? { ios: "chevron.left", android: "chevron_left", web: "chevron_left" }
              : { ios: "xmark", android: "close", web: "close" }
          }
          size={back ? 18 : 16}
          tintColor={foreground}
          weight="semibold"
        />
      </Pressable>
      <Text pointerEvents="none" style={[styles.title, { color: foreground, fontFamily: fontFamily.text }]}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear"
        onPress={onClear}
        style={[styles.clear, styles.headerSide, shadow, { backgroundColor: chrome, borderColor }]}
      >
        <Text style={{ color: colors.foreground, fontFamily: fontFamily.text, fontWeight: "600", fontSize: 16 }}>
          Clear
        </Text>
      </Pressable>
    </View>
  )
}

const SHIP_NAVY = "#001A4A"
const SHIP_WASH = "#E8EEF8"

function ShipToMeChip({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? "Showing listings that ship. Clear ship to me." : "Show only listings that ship to you"}
      onPress={onPress}
      style={[
        styles.chip,
        styles.shipChip,
        active
          ? { backgroundColor: SHIP_NAVY, borderColor: SHIP_NAVY }
          : { backgroundColor: SHIP_WASH, borderColor: "rgba(0, 26, 74, 0.2)" },
      ]}
    >
      <SymbolView
        name={
          active
            ? { ios: "checkmark", android: "check", web: "check" }
            : { ios: "box.truck", android: "local_shipping", web: "local_shipping" }
        }
        size={16}
        tintColor={active ? "#FFFFFF" : SHIP_NAVY}
      />
      <Text style={{ color: active ? "#FFFFFF" : SHIP_NAVY, fontFamily: fontFamily.text, fontSize: 15, fontWeight: "600" }}>
        Ship to me
      </Text>
    </Pressable>
  )
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.foreground : colors.background,
          borderColor: active ? colors.foreground : colors.border,
        },
      ]}
    >
      <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text, fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  )
}

function FilterLink({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={[styles.link, { borderBottomColor: colors.border }]}>
      <View style={styles.linkCopy}>
        <Text style={[styles.linkTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
        <Text style={[styles.linkDetail, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
        size={14}
        tintColor={colors.muted}
        weight="semibold"
      />
    </Pressable>
  )
}

function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      {selected ? (
        <SymbolView
          name={{ ios: "checkmark", android: "check", web: "check" }}
          size={18}
          tintColor={colors.foreground}
          weight="bold"
        />
      ) : null}
    </Pressable>
  )
}

function facetRows(facets: FacetGroup[], showLocation: boolean): Array<FacetGroup | "location"> {
  const style = facets.find((group) => group.id === "style")
  const condition = facets.find((group) => group.id === "condition")
  const rest = facets.filter((group) => group.id !== "style" && group.id !== "condition")
  const rows: Array<FacetGroup | "location"> = []
  if (showLocation) {
    if (style) rows.push(style)
    if (condition) rows.push(condition)
    rows.push("location")
    rows.push(...rest)
    return rows
  }
  return facets
}

function facetDetail(group: FacetGroup, selected: string[]): string {
  if (selected.length === 0) return "None selected"
  return selected
    .map((value) => group.options.find((option) => option.value === value)?.label ?? value)
    .join(", ")
}

function locationDetail(place: CategoryPlace | null, radius: CategoryRadius): string {
  if (!place?.label) return "None selected"
  if (radius === "any") return place.label
  return `${place.label} · ${radius} mi`
}

const shadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: { zIndex: 1 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    position: "absolute",
    left: 88,
    right: 88,
    top: 0,
    bottom: 0,
    lineHeight: 64,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  clear: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  top: { paddingTop: 8, paddingBottom: 12, gap: 10 },
  topLabel: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shipChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkCopy: { flex: 1, gap: 2 },
  linkTitle: { fontSize: 16, fontWeight: "700" },
  linkDetail: { fontSize: 15 },
  option: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionLabel: { flex: 1, fontSize: 16 },
  resultsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  results: {
    minWidth: 180,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
})
