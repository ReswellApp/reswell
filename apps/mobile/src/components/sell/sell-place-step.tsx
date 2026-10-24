import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import { SellLocationField } from "@/components/sell/sell-location-field"
import { SellPackageDimensionsCard } from "@/components/sell/sell-package-dimensions-card"
import { fetchSellDropoffLocations } from "@/lib/api"
import { sanitizePriceInput, SURFBOARDS_CATEGORY_SLUG, type SellDraft } from "@/lib/sell-flow"
import type { MobileSellDropoffLocations, MobileSellFulfillment } from "@reswell/api-contract"

type SellShippingOption = MobileSellFulfillment["shipping_options"][number]
import { fontFamily, useReswellColors } from "@/theme"

export function SellPlaceStep({
  draft,
  fulfillment,
  categoryChosen,
  taxonomyLoading,
  taxonomyError,
  onRetryTaxonomy,
  onChange,
}: {
  draft: SellDraft
  fulfillment: MobileSellFulfillment | null
  /** False until the seller picks a category. Shipping options come from that category. */
  categoryChosen: boolean
  taxonomyLoading: boolean
  taxonomyError: string | null
  onRetryTaxonomy: () => void
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  if (!fulfillment) {
    if (taxonomyError) {
      return (
        <View style={styles.noteStack}>
          <Text style={[styles.note, { color: colors.destructive, fontFamily: fontFamily.text }]}>{taxonomyError}</Text>
          <Pressable accessibilityRole="button" onPress={onRetryTaxonomy}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      )
    }
    return (
      <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {taxonomyLoading
          ? "Loading shipping options…"
          : categoryChosen
            ? "This category doesn’t have shipping options yet."
            : "Choose a category under Info. Shipping options come from that category."}
      </Text>
    )
  }

  const shippingOn = fulfillment.shipping_toggle ? draft.shipping : true
  const mode = fulfillment.shipping_options.some((option) => option.id === draft.shippingMode)
    ? draft.shippingMode
    : (fulfillment.shipping_options[0]?.id ?? "reswell")
  const showPackage = fulfillment.package_dimensions && shippingOn && mode === "reswell"
  const showDropoff = fulfillment.dropoff && shippingOn && mode === "reswell"
  const surfboard = draft.category === SURFBOARDS_CATEGORY_SLUG

  const shippingChoice = fulfillment.shipping_toggle ? (
    <CheckChoice
      label={fulfillment.shipping_label}
      badge={fulfillment.shipping_badge}
      checked={draft.shipping}
      onPress={() => setShipping(!draft.shipping)}
    />
  ) : null
  const pickupChoice = fulfillment.local_pickup ? (
    <CheckChoice
      label="Local pickup"
      badge={null}
      checked={draft.localPickup}
      onPress={() => setPickup(!draft.localPickup)}
    />
  ) : null

  function setShipping(next: boolean) {
    if (!next && fulfillment?.local_pickup && !draft.localPickup) {
      onChange({ shipping: false, localPickup: true, dropoffLocationId: "" })
      return
    }
    onChange({ shipping: next, dropoffLocationId: next ? draft.dropoffLocationId : "" })
  }

  function setPickup(next: boolean) {
    if (!next && !shippingOn) {
      onChange({ localPickup: false, shipping: true })
      return
    }
    onChange({ localPickup: next })
  }

  return (
    <View style={styles.stack}>
      <SellLocationField draft={draft} onChange={onChange} />
      {fulfillment.shipping_toggle || fulfillment.local_pickup ? (
        <View style={styles.delivery}>
          {fulfillment.delivery_title ? (
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {fulfillment.delivery_title}
              <Text style={{ color: colors.destructive }}> *</Text>
            </Text>
          ) : null}
          {fulfillment.hint ? (
            <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{fulfillment.hint}</Text>
          ) : null}
          {surfboard ? (
            <>
              {pickupChoice}
              {shippingChoice}
            </>
          ) : (
            <>
              {shippingChoice}
              {pickupChoice}
            </>
          )}
        </View>
      ) : null}

      {shippingOn && fulfillment.shipping_options.length > 0 ? (
        <ShippingCostOptions
          costTitle={fulfillment.cost_title}
          options={fulfillment.shipping_options}
          mode={mode}
          draft={draft}
          collapseAltOptions={!surfboard}
          onChange={onChange}
        />
      ) : null}

      {shippingOn && fulfillment.shipping_options.length === 0 && fulfillment.shipping_detail ? (
        <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {fulfillment.shipping_detail}
        </Text>
      ) : null}

      {showDropoff ? (
        <DropoffChoices
          selectedId={draft.dropoffLocationId}
          boardLength={draft.specs.length ?? ""}
          boardWidth={draft.specs.width ?? ""}
          onSelect={(location) =>
            onChange({
              dropoffLocationId: location.id,
              packageLength: location.package?.length ?? draft.packageLength,
              packageWidth: location.package?.width ?? draft.packageWidth,
              packageHeight: location.package?.height ?? draft.packageHeight,
              packageWeightLb: location.package?.weight_lb ?? draft.packageWeightLb,
              packageWeightOz: location.package?.weight_oz ?? draft.packageWeightOz,
            })
          }
          onClear={() => onChange({ dropoffLocationId: "" })}
        />
      ) : null}
      {showPackage && !draft.dropoffLocationId ? (
        <SellPackageDimensionsCard draft={draft} onChange={onChange} />
      ) : null}

    </View>
  )
}

function ShippingCostOptions({
  costTitle,
  options,
  mode,
  draft,
  collapseAltOptions,
  onChange,
}: {
  costTitle: string | null
  options: SellShippingOption[]
  mode: SellDraft["shippingMode"]
  draft: SellDraft
  collapseAltOptions: boolean
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  const reswell = options.find((option) => option.id === "reswell")
  const more = options.filter((option) => option.id !== "reswell")
  const selectedMore = more.find((option) => option.id === mode)
  const [moreOpen, setMoreOpen] = useState(mode === "free" || mode === "flat")

  useEffect(() => {
    if (mode === "free" || mode === "flat") setMoreOpen(true)
  }, [mode])

  function renderOption(option: SellShippingOption, inSection = false) {
    const selected = option.id === mode
    return (
      <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={() => onChange({ shippingMode: option.id, shipping: true })}
        style={[
          styles.option,
          inSection ? styles.optionInSection : null,
          { borderColor: colors.foreground, backgroundColor: colors.background },
        ]}
      >
        <View style={[styles.radio, { borderColor: colors.foreground }]}>
          {selected ? <View style={[styles.radioDot, { backgroundColor: colors.listingHeart }]} /> : null}
        </View>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {option.label}
          </Text>
          {option.badge ? (
            <View style={styles.badgeWrap}>
              <Badge label={option.badge} />
            </View>
          ) : null}
          {selected ? (
            <Text style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {option.detail}
            </Text>
          ) : null}
          {selected && option.id === "flat" ? (
            <SellField
              label="Shipping price"
              value={draft.shippingPrice}
              onChangeText={(shippingPrice) => onChange({ shippingPrice: sanitizePriceInput(shippingPrice) })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
            />
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.options}>
      {costTitle ? (
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {costTitle}
          <Text style={{ color: colors.destructive }}> *</Text>
        </Text>
      ) : null}
      {collapseAltOptions && reswell ? (
        <View style={[styles.shippingSection, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
          {renderOption(reswell, true)}
          {more.length > 0 ? (
            <>
              <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: moreOpen }}
                onPress={() => setMoreOpen((open) => !open)}
                style={styles.moreHeader}
              >
                <View style={styles.moreHeaderCopy}>
                  <Text style={[styles.moreHeaderTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    More options
                  </Text>
                  {selectedMore && !moreOpen ? (
                    <Text
                      style={[styles.moreHeaderSubtitle, { color: colors.muted, fontFamily: fontFamily.text }]}
                      numberOfLines={2}
                    >
                      {selectedMore.label}
                    </Text>
                  ) : null}
                </View>
                <SymbolView
                  name={{
                    ios: moreOpen ? "chevron.up" : "chevron.down",
                    android: moreOpen ? "expand_less" : "expand_more",
                    web: "expand_more",
                  }}
                  size={18}
                  tintColor={colors.muted}
                  weight="semibold"
                />
              </Pressable>
              {moreOpen ? (
                <>
                  <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.moreOptionsInset}>{more.map((option) => renderOption(option, true))}</View>
                </>
              ) : null}
            </>
          ) : null}
        </View>
      ) : (
        options.map((option) => renderOption(option))
      )}
    </View>
  )
}

function CheckChoice({
  label,
  badge,
  checked,
  onPress,
}: {
  label: string
  badge: string | null
  checked: boolean
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.listingHeart : colors.foreground,
            backgroundColor: checked ? colors.listingHeart : "transparent",
          },
        ]}
      >
        {checked ? (
          <SymbolView name={{ ios: "checkmark", android: "check", web: "check" }} size={12} tintColor="#FFFFFF" weight="bold" />
        ) : null}
      </View>
      <Text style={[styles.checkLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      {badge ? <Badge label={badge} /> : null}
    </Pressable>
  )
}

function Badge({ label }: { label: string }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.badge, { backgroundColor: colors.listingHeart }]}>
      <Text style={[styles.badgeLabel, { fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
}

function DropoffChoices({
  selectedId,
  boardLength,
  boardWidth,
  onSelect,
  onClear,
}: {
  selectedId: string
  boardLength: string
  boardWidth: string
  onSelect: (location: MobileSellDropoffLocations["locations"][number]) => void
  onClear: () => void
}) {
  const colors = useReswellColors()
  const [locations, setLocations] = useState<MobileSellDropoffLocations["locations"] | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    fetchSellDropoffLocations(boardLength, boardWidth)
      .then((result) => {
        if (!cancelled) setLocations(result.locations)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [reload, boardLength, boardWidth])

  return (
    <View style={styles.options}>
      <Text style={[styles.packageTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        How will this board get packed?
      </Text>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: selectedId === "" }}
        onPress={onClear}
        style={[styles.option, { borderColor: colors.foreground }]}
      >
        <View style={styles.optionCopy}>
          <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            I'll pack and ship it myself
          </Text>
          <Text style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Enter the outer box size and weight you'll ship in.
          </Text>
        </View>
      </Pressable>
      <View style={[styles.option, { borderColor: colors.foreground }]}>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Drop off nearby — we pack and ship it
          </Text>
          {error ? (
            <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)}>
              <Text style={[styles.optionDetail, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
                Couldn't load drop-off cities. Retry
              </Text>
            </Pressable>
          ) : locations == null ? (
            <Text style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Loading drop-off cities…
            </Text>
          ) : locations.length === 0 ? (
            <Text style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No drop-off cities are available right now. Pack and ship it yourself.
            </Text>
          ) : (
            locations.map((location) => {
              const selected = selectedId === location.id
              return (
                <Pressable
                  key={location.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !location.available }}
                  disabled={!location.available}
                  onPress={() => onSelect(location)}
                  style={[
                    styles.city,
                    {
                      borderColor: colors.foreground,
                      opacity: location.available ? 1 : 0.7,
                    },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {location.city}, {location.state}
                  </Text>
                  <Text style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {location.detail}
                  </Text>
                </Pressable>
              )
            })
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  delivery: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  noteStack: { gap: 8 },
  retry: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkLabel: { fontSize: 15, fontWeight: "600" },
  options: { gap: 10 },
  shippingSection: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  sectionDivider: { height: StyleSheet.hairlineWidth },
  moreHeader: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  moreHeaderCopy: { flex: 1, gap: 4 },
  moreHeaderTitle: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  moreHeaderSubtitle: { fontSize: 13, lineHeight: 18 },
  moreOptionsInset: { gap: 0, paddingBottom: 4 },
  option: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  optionInSection: { borderWidth: 0, borderRadius: 0 },
  optionCopy: { flex: 1, minWidth: 0, gap: 6 },
  optionLabel: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  badgeWrap: { alignSelf: "flex-start" },
  optionDetail: { fontSize: 14, lineHeight: 20 },
  city: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  packageTitle: { fontSize: 15, fontWeight: "700" },
})
