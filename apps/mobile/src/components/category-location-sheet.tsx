import { SymbolView } from "expo-symbols"
import { useRef, useState } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  CategoryLocationFilter,
  LOCATION_PIN,
  type CategoryLocationHandle,
  type CategoryPlace,
  type CategoryRadius,
} from "@/components/category-location-filter"
import { locationButtonLabel } from "@/lib/location-button-label"
import { fontFamily, useReswellColors } from "@/theme"

type CategoryLocationButtonProps = {
  place: CategoryPlace | null
  radius: CategoryRadius
  onPlaceChange: (place: CategoryPlace | null) => void
  onRadiusChange: (radius: CategoryRadius) => void
}

/** Website-style pin + city, opening a mobile location sheet. */
export function CategoryLocationButton({
  place,
  radius,
  onPlaceChange,
  onRadiusChange,
}: CategoryLocationButtonProps) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const locationRef = useRef<CategoryLocationHandle>(null)
  const [open, setOpen] = useState(false)
  const hasLocation = Boolean(place?.label?.trim())
  const label = locationButtonLabel(place?.label ?? "")

  function close() {
    locationRef.current?.commit()
    setOpen(false)
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasLocation ? `Filter by location: ${label}` : "Filter by location"}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.trigger}
      >
        <SymbolView
          name={{ ios: "mappin.and.ellipse", android: "place", web: "place" }}
          size={18}
          tintColor={LOCATION_PIN}
        />
        <Text
          numberOfLines={1}
          style={[styles.triggerLabel, { color: LOCATION_PIN, fontFamily: fontFamily.text }]}
        >
          {label}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.scrim}>
          <Pressable accessibilityLabel="Dismiss location filter" onPress={close} style={styles.dismiss} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View
              style={[
                styles.sheet,
                { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <View style={styles.grabberWrap}>
                <View style={[styles.grabber, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  Location
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close location filter"
                  onPress={close}
                  style={[styles.close, { backgroundColor: colors.image }]}
                >
                  <SymbolView
                    name={{ ios: "xmark", android: "close", web: "close" }}
                    size={14}
                    tintColor={colors.foreground}
                    weight="semibold"
                  />
                </Pressable>
              </View>
              <View style={styles.body}>
                {open ? (
                  <CategoryLocationFilter
                    ref={locationRef}
                    place={place}
                    onPlaceChange={onPlaceChange}
                    radius={radius}
                    onRadiusChange={onRadiusChange}
                    autoFocus
                  />
                ) : null}
              </View>
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  onPress={close}
                  style={[styles.done, { backgroundColor: colors.foreground }]}
                >
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontFamily: fontFamily.text,
                      fontSize: 17,
                      fontWeight: "700",
                    }}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { alignItems: "flex-end" },
  trigger: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  triggerLabel: { fontSize: 16, fontWeight: "700" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.28)" },
  dismiss: { flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  grabberWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  grabber: { width: 36, height: 5, borderRadius: 2.5 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingBottom: 8, overflow: "visible", zIndex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
})
