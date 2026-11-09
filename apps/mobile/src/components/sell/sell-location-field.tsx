import * as Location from "expo-location"
import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { fetchSellPlaceDetails, fetchSellPlaceSuggestions, fetchStructuredPlace } from "@/lib/api"
import type { SellDraft } from "@/lib/sell-flow"
import type { MobilePlaceSuggestion } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export function SellLocationField({
  draft,
  onChange,
}: {
  draft: SellDraft
  onChange: (patch: Partial<SellDraft>) => void
}) {
  const colors = useReswellColors()
  const [query, setQuery] = useState(draft.locationLabel)
  const [suggestions, setSuggestions] = useState<MobilePlaceSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (draft.locationLabel) setQuery(draft.locationLabel)
  }, [draft.locationLabel])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || trimmed === draft.locationLabel) {
      setSuggestions([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      fetchSellPlaceSuggestions(trimmed)
        .then((result) => {
          if (!cancelled) setSuggestions(result.suggestions)
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
  }, [draft.locationLabel, query])

  function clearPlace() {
    onChange({
      locationLabel: "",
      city: "",
      state: "",
      locationLat: null,
      locationLng: null,
    })
  }

  function commitPlace(place: { label: string; city: string; state: string; lat: number; lng: number }) {
    setQuery(place.label)
    setSuggestions([])
    setNote(null)
    onChange({
      locationLabel: place.label,
      city: place.city,
      state: place.state,
      locationLat: place.lat,
      locationLng: place.lng,
    })
  }

  async function pick(suggestion: MobilePlaceSuggestion) {
    setSuggestions([])
    setNote(null)
    if (suggestion.place_id) {
      setSearching(true)
      try {
        const place = await fetchSellPlaceDetails(suggestion.place_id)
        commitPlace(place)
      } catch {
        setNote("Couldn't use that place. Try another.")
      } finally {
        setSearching(false)
      }
      return
    }
    if (suggestion.lat == null || suggestion.lng == null || !suggestion.city || !suggestion.state) {
      setNote("Choose a city from the list.")
      return
    }
    commitPlace({
      label: suggestion.label,
      city: suggestion.city,
      state: suggestion.state,
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
        setNote("Allow location access, or search for a city.")
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const place = await fetchStructuredPlace(position.coords.latitude, position.coords.longitude)
      if (!place) {
        setNote("Couldn't read that location. Search for a city instead.")
        return
      }
      commitPlace({
        label: place.label,
        city: place.city,
        state: place.state,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
    } catch {
      setNote("Location unavailable. Search for a city.")
    } finally {
      setLocating(false)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>
        Where are you listing from?
      </Text>
      <TextInput
        value={query}
        onChangeText={(value) => {
          setQuery(value)
          setNote(null)
          if (draft.locationLat != null) clearPlace()
        }}
        placeholder="Start typing a city, ZIP, or beach…"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        autoCorrect={false}
        style={[styles.input, { color: colors.foreground, borderColor: colors.foreground, fontFamily: fontFamily.text }]}
      />
      {searching ? <ActivityIndicator color={colors.listingHeart} style={styles.spinner} /> : null}
      {suggestions.length > 0 ? (
        <View style={[styles.menu, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.place_id ?? `${suggestion.label}-${suggestion.lat}`}
              accessibilityRole="button"
              onPress={() => void pick(suggestion)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" disabled={locating} onPress={() => void useMyLocation()} style={styles.locate}>
        {locating ? <ActivityIndicator color={colors.listingHeart} /> : null}
        <Text style={[styles.locateLabel, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
          Use my current location
        </Text>
      </Pressable>
      {note ? <Text style={[styles.note, { color: colors.destructive, fontFamily: fontFamily.text }]}>{note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: "700" },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  spinner: { alignSelf: "flex-start" },
  menu: { borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  row: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 16 },
  locate: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8 },
  locateLabel: { fontSize: 15, fontWeight: "600" },
  note: { fontSize: 14 },
})
