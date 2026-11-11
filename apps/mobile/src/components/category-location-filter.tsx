import * as Location from "expo-location"
import { SymbolView } from "expo-symbols"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { MobilePlaceSuggestion } from "@reswell/api-contract"
import { fetchPlaceSuggestions, fetchSellPlaceDetails, fetchStructuredPlace, reverseGeocodeLabel } from "@/lib/api"
import { fontFamily, useReswellColors } from "@/theme"

export type CategoryPlace = {
  label: string
  lat?: number
  lng?: number
}

export const CATEGORY_RADIUS = ["any", "25", "50", "100", "200"] as const
export type CategoryRadius = (typeof CATEGORY_RADIUS)[number]

const RADIUS_CHIPS: { value: CategoryRadius; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "200", label: "200" },
]

/** Same pin/chip blue as the website boards location filter. */
export const LOCATION_PIN = "#1877F2"

export type CategoryLocationHandle = {
  commit: () => void
}

type CategoryLocationFilterProps = {
  place: CategoryPlace | null
  onPlaceChange: (place: CategoryPlace | null) => void
  radius: CategoryRadius
  onRadiusChange: (radius: CategoryRadius) => void
  autoFocus?: boolean
}

export const CategoryLocationFilter = forwardRef<CategoryLocationHandle, CategoryLocationFilterProps>(
  function CategoryLocationFilter({ place, onPlaceChange, radius, onRadiusChange, autoFocus = false }, ref) {
    const colors = useReswellColors()
    const [draft, setDraft] = useState(place?.label ?? "")
    const [suggestions, setSuggestions] = useState<MobilePlaceSuggestion[]>([])
    const [searching, setSearching] = useState(false)
    const [locating, setLocating] = useState(false)
    const [resolvingId, setResolvingId] = useState<string | null>(null)
    const [note, setNote] = useState<string | null>(null)
    const [focused, setFocused] = useState(false)

    useEffect(() => {
      setDraft(place?.label ?? "")
    }, [place])

    useEffect(() => {
      const query = draft.trim()
      if (query.length < 2 || query === place?.label) {
        setSuggestions([])
        setSearching(false)
        return
      }
      let cancelled = false
      setSearching(true)
      const timer = setTimeout(() => {
        fetchPlaceSuggestions(query)
          .then((rows) => {
            if (!cancelled) setSuggestions(rows)
          })
          .catch(() => {
            if (!cancelled) setSuggestions([])
          })
          .finally(() => {
            if (!cancelled) setSearching(false)
          })
      }, 250)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [draft, place?.label])

    function applyPlace(next: CategoryPlace) {
      Keyboard.dismiss()
      setDraft(next.label)
      setSuggestions([])
      setNote(null)
      onPlaceChange(next)
    }

    function clearPlace() {
      setDraft("")
      setSuggestions([])
      setNote(null)
      onPlaceChange(null)
      onRadiusChange("any")
    }

    function commitDraft() {
      const label = draft.trim()
      if (!label) {
        if (place) clearPlace()
        return
      }
      if (place?.label === label) return
      onPlaceChange({ label })
    }

    useImperativeHandle(ref, () => ({ commit: commitDraft }))

    async function pick(suggestion: MobilePlaceSuggestion) {
      if (suggestion.place_id) {
        setResolvingId(suggestion.place_id)
        setNote(null)
        try {
          const details = await fetchSellPlaceDetails(suggestion.place_id)
          applyPlace({
            label: `${details.city}, ${details.state}`,
            lat: details.lat,
            lng: details.lng,
          })
        } catch {
          setNote("Couldn't use that place. Try another.")
        } finally {
          setResolvingId(null)
        }
        return
      }
      if (suggestion.lat == null || suggestion.lng == null) {
        setNote("Choose a city from the list.")
        return
      }
      const city = suggestion.city.trim()
      const state = suggestion.state.trim()
      applyPlace({
        label: city && state ? `${city}, ${state}` : suggestion.label,
        lat: suggestion.lat,
        lng: suggestion.lng,
      })
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
        const structured = await fetchStructuredPlace(lat, lng)
        const label = structured?.label ?? (await reverseGeocodeLabel(lat, lng)) ?? "Current location"
        applyPlace({ label, lat, lng })
      } catch {
        setNote("Location unavailable. Enter a city or ZIP.")
      } finally {
        setLocating(false)
      }
    }

    return (
      <View style={styles.wrap}>
        <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.text }]}>Where</Text>
        <View style={styles.search}>
          <View
            style={[
              styles.pill,
              { backgroundColor: colors.secondary, borderColor: focused ? LOCATION_PIN : colors.border },
            ]}
          >
            <SymbolView
              name={{ ios: "mappin.and.ellipse", android: "place", web: "place" }}
              size={18}
              tintColor={LOCATION_PIN}
            />
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value)
                setNote(null)
                if (!value.trim() && place) {
                  onPlaceChange(null)
                  onRadiusChange("any")
                }
              }}
              onSubmitEditing={commitDraft}
              placeholder="City or ZIP"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus={autoFocus}
              returnKeyType="search"
              accessibilityLabel="City or ZIP"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.text }]}
            />
            {searching || resolvingId ? <ActivityIndicator color={LOCATION_PIN} /> : null}
            {draft.trim() && !searching && !resolvingId ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear location" onPress={clearPlace} hitSlop={8}>
                <SymbolView
                  name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
                  size={18}
                  tintColor={colors.muted}
                />
              </Pressable>
            ) : null}
          </View>
          {suggestions.length > 0 ? (
            <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {suggestions.slice(0, 4).map((suggestion, index, rows) => {
                const key = suggestion.place_id ?? `${suggestion.label}-${suggestion.lat}`
                const busy = resolvingId === suggestion.place_id
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => void pick(suggestion)}
                    style={[
                      styles.suggestion,
                      index < rows.length - 1
                        ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                        : null,
                    ]}
                  >
                    <SymbolView
                      name={{ ios: "mappin", android: "place", web: "place" }}
                      size={16}
                      tintColor={LOCATION_PIN}
                    />
                    <Text
                      style={[styles.suggestionLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}
                      numberOfLines={1}
                    >
                      {suggestion.label}
                    </Text>
                    {busy ? <ActivityIndicator color={LOCATION_PIN} /> : null}
                  </Pressable>
                )
              })}
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          disabled={locating}
          onPress={() => void useMyLocation()}
          style={[styles.locate, { backgroundColor: colors.secondary }]}
        >
          {locating ? (
            <ActivityIndicator color={LOCATION_PIN} />
          ) : (
            <SymbolView
              name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
              size={18}
              tintColor={LOCATION_PIN}
            />
          )}
          <Text style={[styles.locateLabel, { color: LOCATION_PIN, fontFamily: fontFamily.text }]}>
            {locating ? "Finding you…" : "Use my current location"}
          </Text>
        </Pressable>
        {note ? <Text style={[styles.note, { color: colors.muted, fontFamily: fontFamily.text }]}>{note}</Text> : null}
        <View style={styles.distance}>
          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            Distance in miles
          </Text>
          <View style={styles.chips} accessibilityLabel="Search radius">
            {RADIUS_CHIPS.map((chip) => {
              const selected = chip.value === radius
              return (
                <Pressable
                  key={chip.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onRadiusChange(chip.value)}
                  style={[
                    styles.chip,
                    selected ? { backgroundColor: LOCATION_PIN } : { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : colors.foreground,
                      fontFamily: fontFamily.text,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    )
  },
)

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 12, overflow: "visible" },
  section: { fontSize: 15, fontWeight: "700" },
  search: { zIndex: 2 },
  pill: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: 14 },
  locate: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locateLabel: { fontSize: 16, fontWeight: "600" },
  suggestions: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 3,
    elevation: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestion: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  suggestionLabel: { flex: 1, fontSize: 16 },
  note: { fontSize: 14, lineHeight: 20 },
  distance: { gap: 12, paddingTop: 8 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
})
