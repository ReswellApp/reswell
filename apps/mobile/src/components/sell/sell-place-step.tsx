import { SymbolView } from "expo-symbols"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { SellField } from "@/components/sell/sell-field"
import { SellLocationField } from "@/components/sell/sell-location-field"
import { fetchSellDropoffLocations } from "@/lib/api"
import { sanitizePriceInput, type SellDraft } from "@/lib/sell-flow"
import type { MobileSellDropoffLocations, MobileSellFulfillment } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellPlaceStep({
  draft,
  fulfillment,
  onChange,
}: {
  draft: SellDraft
  fulfillment: MobileSellFulfillment | null
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  if (!fulfillment) {
    return (
      <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Loading shipping options…
      </Text>
    )
  }

  const shippingOn = fulfillment.shipping_toggle ? draft.shipping : true
  const mode = fulfillment.shipping_options.some((option) => option.id === draft.shippingMode)
    ? draft.shippingMode
    : (fulfillment.shipping_options[0]?.id ?? "reswell")
  const showPackage = fulfillment.package_dimensions && shippingOn && mode === "reswell"
  const showDropoff = fulfillment.dropoff && shippingOn && mode === "reswell"

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
          {fulfillment.shipping_toggle ? (
            <CheckChoice
              label={fulfillment.shipping_label}
              badge={fulfillment.shipping_badge}
              checked={draft.shipping}
              onPress={() => setShipping(!draft.shipping)}
            />
          ) : null}
          {fulfillment.local_pickup ? (
            <CheckChoice
              label="Local pickup"
              badge={null}
              checked={draft.localPickup}
              onPress={() => setPickup(!draft.localPickup)}
            />
          ) : null}
        </View>
      ) : null}

      {shippingOn && fulfillment.shipping_options.length > 0 ? (
        <View style={styles.options}>
          {fulfillment.cost_title ? (
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {fulfillment.cost_title}
              <Text style={{ color: colors.destructive }}> *</Text>
            </Text>
          ) : null}
          {fulfillment.shipping_options.map((option) => {
            const selected = option.id === mode
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange({ shippingMode: option.id, shipping: true })}
                style={[
                  styles.option,
                  { borderColor: selected ? colors.foreground : colors.border, backgroundColor: colors.background },
                ]}
              >
                <View style={[styles.radio, { borderColor: colors.foreground }]}>
                  {selected ? <View style={[styles.radioDot, { backgroundColor: colors.listingHeart }]} /> : null}
                </View>
                <View style={styles.optionCopy}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                      {option.label}
                    </Text>
                    {option.badge ? <Badge label={option.badge} /> : null}
                  </View>
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
          })}
        </View>
      ) : null}

      {shippingOn && fulfillment.shipping_options.length === 0 && fulfillment.shipping_detail ? (
        <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {fulfillment.shipping_detail}
        </Text>
      ) : null}

      {showPackage ? <PackageFields draft={draft} onChange={onChange} /> : null}
      {showDropoff ? (
        <DropoffChoices
          selectedId={draft.dropoffLocationId}
          onSelect={(dropoffLocationId) => onChange({ dropoffLocationId })}
        />
      ) : null}

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

function PackageFields({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.package}>
      <Text style={[styles.packageTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        Packed size & weight
      </Text>
      <View style={styles.packageRow}>
        <PackageInput label="Length" value={draft.packageLength} onChangeText={(packageLength) => onChange({ packageLength })} />
        <PackageInput label="Width" value={draft.packageWidth} onChangeText={(packageWidth) => onChange({ packageWidth })} />
        <PackageInput label="Height" value={draft.packageHeight} onChangeText={(packageHeight) => onChange({ packageHeight })} />
      </View>
      <View style={styles.packageRow}>
        <PackageInput
          label="Pounds"
          value={draft.packageWeightLb}
          onChangeText={(packageWeightLb) => onChange({ packageWeightLb })}
        />
        <PackageInput
          label="Ounces"
          value={draft.packageWeightOz}
          onChangeText={(packageWeightOz) => onChange({ packageWeightOz })}
        />
      </View>
    </View>
  )
}

function PackageInput({
  label,
  value,
  onChangeText,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.packageField}>
      <Text style={[styles.packageLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={[styles.packageInput, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
      />
    </View>
  )
}

function DropoffChoices({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  const colors = useReswellColors()
  const [locations, setLocations] = useState<MobileSellDropoffLocations["locations"] | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    fetchSellDropoffLocations()
      .then((result) => {
        if (!cancelled) setLocations(result.locations)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  return (
    <View style={styles.options}>
      <Text style={[styles.packageTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        How will this board get packed?
      </Text>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: selectedId === "" }}
        onPress={() => onSelect("")}
        style={[styles.option, { borderColor: selectedId === "" ? colors.foreground : colors.border }]}
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
      <View style={[styles.option, { borderColor: selectedId ? colors.foreground : colors.border }]}>
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
            locations.map((location) => (
              <Text
                key={location.id}
                style={[styles.optionDetail, { color: colors.muted, fontFamily: fontFamily.text }]}
              >
                {location.city}, {location.state} — add board length with the photos to drop off here.
              </Text>
            ))
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkLabel: { fontSize: 15, fontWeight: "600" },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  optionCopy: { flex: 1, gap: 6 },
  optionTitleRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  optionLabel: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  optionDetail: { fontSize: 14, lineHeight: 20 },
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
  package: { gap: 8 },
  packageTitle: { fontSize: 15, fontWeight: "700" },
  packageRow: { flexDirection: "row", gap: 8 },
  packageField: { flex: 1, gap: 4 },
  packageLabel: { fontSize: 12, fontWeight: "600" },
  packageInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
  },
})
