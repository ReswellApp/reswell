import * as Location from "expo-location"
import { SymbolView } from "expo-symbols"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { fetchPlaceSuggestions, reverseGeocodeLabel, type PlaceSuggestion } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export type CategoryPlace = {
  label: string
  lat?: number
  lng?: number
}

export const CATEGORY_RADIUS = ["any", "25", "50", "100", "200"] as const
export type CategoryRadius = (typeof CATEGORY_RADIUS)[number]

const RADIUS_LABELS: Record<CategoryRadius, string> = {
  any: "Any distance",
  "25": "25 Miles",
  "50": "50 Miles",
  "100": "100 Miles",
  "200": "200 Miles",
}

export type CategoryLocationHandle = {
  commit: () => void
}

type CategoryLocationFilterProps = {
  place: CategoryPlace | null
  onPlaceChange: (place: CategoryPlace | null) => void
  radius: CategoryRadius
  onRadiusChange: (radius: CategoryRadius) => void
}

export const CategoryLocationFilter = forwardRef<CategoryLocationHandle, CategoryLocationFilterProps>(
  function CategoryLocationFilter({ place, onPlaceChange, radius, onRadiusChange }, ref) {
    const colors = useReswellColors()
    const [enabled, setEnabled] = useState(Boolean(place))
    const [draft, setDraft] = useState(place?.label ?? "")
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
    const [locating, setLocating] = useState(false)
    const [note, setNote] = useState<string | null>(null)

    useEffect(() => {
      setDraft(place?.label ?? "")
    }, [place])

    useEffect(() => {
      const query = draft.trim()
      if (!enabled || query.length < 2 || query === place?.label) {
        setSuggestions([])
        return
      }
      let cancelled = false
      const timer = setTimeout(() => {
        fetchPlaceSuggestions(query)
          .then((rows) => {
            if (!cancelled) setSuggestions(rows)
          })
          .catch(() => {
            if (!cancelled) setSuggestions([])
          })
      }, 250)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [draft, enabled, place?.label])

    function commitDraft() {
      if (!enabled) {
        onPlaceChange(null)
        return
      }
      const label = draft.trim()
      if (!label) {
        onPlaceChange(null)
        return
      }
      if (place?.label === label) return
      onPlaceChange({ label })
    }

    useImperativeHandle(ref, () => ({ commit: commitDraft }))

    function setNearMe(next: boolean) {
      setEnabled(next)
      setNote(null)
      setSuggestions([])
      if (!next) {
        setDraft("")
        onPlaceChange(null)
        onRadiusChange("any")
      }
    }

    function pick(suggestion: PlaceSuggestion) {
      setDraft(suggestion.label)
      setSuggestions([])
      setNote(null)
      onPlaceChange({ label: suggestion.label, lat: suggestion.lat, lng: suggestion.lng })
    }

    async function useMyLocation() {
      setLocating(true)
      setNote(null)
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status !== "granted") {
          setNote("Allow location access, or enter a city or ZIP.")
          return
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const label = (await reverseGeocodeLabel(lat, lng)) ?? "Current location"
        setDraft(label)
        setSuggestions([])
        onPlaceChange({ label, lat, lng })
      } catch {
        setNote("Location unavailable. Enter a city or ZIP.")
      } finally {
        setLocating(false)
      }
    }

    return (
      <View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Only show items near me
          </Text>
          <Switch
            accessibilityLabel="Only show items near me"
            value={enabled}
            onValueChange={setNearMe}
            trackColor={{ false: colors.border, true: "#34C759" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.border}
          />
        </View>
        {enabled ? (
          <View style={styles.near}>
            <View style={[styles.field, { borderColor: colors.foreground }]}>
              <Text style={[styles.fieldLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>City or ZIP</Text>
              <TextInput
                value={draft}
                onChangeText={(value) => {
                  setDraft(value)
                  setNote(null)
                  if (!value.trim() && place) onPlaceChange(null)
                }}
                onSubmitEditing={commitDraft}
                placeholder="City or ZIP"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="search"
                style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
              />
            </View>
            {suggestions.length > 0 ? (
              <View style={[styles.suggestions, { borderColor: colors.border }]}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={`${suggestion.label}-${suggestion.lat}`}
                    onPress={() => pick(suggestion)}
                    style={[styles.suggestion, { borderBottomColor: colors.border }]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: fontFamily.text, fontSize: 16 }}>
                      {suggestion.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              disabled={locating}
              onPress={() => void useMyLocation()}
              style={styles.locate}
            >
              {locating ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <SymbolView
                  name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
                  size={16}
                  tintColor={colors.foreground}
                />
              )}
              <Text style={[styles.locateLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Use my current location
              </Text>
            </Pressable>
            {note ? <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{note}</Text> : null}
            <View>
              {CATEGORY_RADIUS.map((value) => {
                const active = value === radius
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => onRadiusChange(value)}
                    style={[styles.radiusRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.radiusLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                      {RADIUS_LABELS[value]}
                    </Text>
                    {active ? (
                      <SymbolView
                        name={{ ios: "checkmark", android: "check", web: "check" }}
                        size={18}
                        tintColor={colors.foreground}
                        weight="semibold"
                      />
                    ) : (
                      <View style={[styles.radio, { borderColor: colors.muted }]} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}
      </View>
    )
  },
)

const styles = StyleSheet.create({
  toggleRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: { flex: 1, fontSize: 16 },
  near: { paddingTop: 8, gap: 4 },
  field: {
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  fieldLabel: { fontSize: 12 },
  input: { fontSize: 17, paddingVertical: 2 },
  suggestions: { marginHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  suggestion: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  locate: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locateLabel: { fontSize: 16 },
  note: { paddingHorizontal: 16, fontSize: 13 },
  radiusRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radiusLabel: { fontSize: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
})
