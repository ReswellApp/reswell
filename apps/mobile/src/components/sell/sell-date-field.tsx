import DateTimePicker from "@expo/ui/community/datetime-picker"
import { SymbolView } from "expo-symbols"
import { createElement, useMemo, useState } from "react"
import { Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { sellerPurchasedOnValue } from "@/lib/sell-flow"
import { fontFamily, useReswellColors } from "@/theme"

const MIN_PURCHASE_DATE = new Date(1950, 0, 1)

export function SellDateField({
  label,
  value,
  onChange,
  placeholder = "Choose a date",
}: {
  label: string
  /** Calendar day as `YYYY-MM-DD`, or empty. */
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => dateFromDay(value), [value])
  const [pending, setPending] = useState(() => selected ?? new Date())
  const display = selected
    ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : ""
  const maxDate = endOfToday()

  function openPicker() {
    setPending(selected ?? new Date())
    setOpen(true)
  }

  function commit(date: Date) {
    onChange(dayFromDate(date))
    setOpen(false)
  }

  function clear() {
    onChange("")
    setOpen(false)
  }

  if (process.env.EXPO_OS === "web") {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
        {createElement("input", {
          type: "date",
          value,
          min: dayFromDate(MIN_PURCHASE_DATE),
          max: dayFromDate(maxDate),
          "aria-label": label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            fontSize: 16,
            fontFamily: fontFamily.text,
            color: colors.foreground,
            backgroundColor: colors.background,
            border: `1px solid ${colors.foreground}`,
            borderRadius: 8,
            padding: "12px 14px",
            width: "100%",
            boxSizing: "border-box",
            minHeight: 48,
          },
        })}
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      <View style={[styles.input, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={display ? `${label}, ${display}` : `${label}, ${placeholder}`}
          onPress={openPicker}
          style={styles.inputMain}
        >
          <Text
            style={[
              styles.value,
              { color: display ? colors.foreground : colors.muted, fontFamily: fontFamily.text },
            ]}
          >
            {display || placeholder}
          </Text>
        </Pressable>
        {display ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={8}
            onPress={() => onChange("")}
            style={styles.clearHit}
          >
            <SymbolView
              name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
              size={18}
              tintColor={colors.muted}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={display ? `Change ${label}` : `Choose ${label}`}
          onPress={openPicker}
          style={styles.clearHit}
        >
          <SymbolView
            name={{ ios: "calendar", android: "calendar_today", web: "calendar_today" }}
            size={18}
            tintColor={colors.muted}
          />
        </Pressable>
      </View>

      {open && process.env.EXPO_OS === "android" ? (
        <DateTimePicker
          value={pending}
          mode="date"
          display="default"
          presentation="dialog"
          minimumDate={MIN_PURCHASE_DATE}
          maximumDate={maxDate}
          onValueChange={(_, date) => {
            if (date) commit(date)
            else setOpen(false)
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {open && process.env.EXPO_OS === "ios" ? (
        <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.headerAction}>
                <Text style={[styles.headerActionLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{label}</Text>
              <Pressable accessibilityRole="button" onPress={() => commit(pending)} style={styles.headerAction}>
                <Text style={[styles.done, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.calendar}>
              <DateTimePicker
                value={pending}
                mode="date"
                display="inline"
                minimumDate={MIN_PURCHASE_DATE}
                maximumDate={maxDate}
                onValueChange={(_, date) => {
                  if (date) setPending(date)
                }}
                style={styles.picker}
              />
            </View>
            {value ? (
              <Pressable
                accessibilityRole="button"
                onPress={clear}
                style={[styles.clearRow, { paddingBottom: insets.bottom + 16 }]}
              >
                <Text style={[styles.clearLabel, { color: colors.destructive, fontFamily: fontFamily.text }]}>
                  Clear date
                </Text>
              </Pressable>
            ) : (
              <View style={{ height: insets.bottom + 16 }} />
            )}
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function dateFromDay(raw: string): Date | null {
  const day = sellerPurchasedOnValue(raw)
  if (!day) return null
  return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
}

function dayFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function endOfToday(): Date {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 15, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputMain: { flex: 1, minHeight: 24, justifyContent: "center" },
  value: { fontSize: 16 },
  clearHit: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAction: { minWidth: 72, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  headerActionLabel: { fontSize: 16 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
  done: { fontSize: 16, fontWeight: "700" },
  calendar: { paddingHorizontal: 8, paddingTop: 12 },
  picker: { alignSelf: "stretch", minHeight: 360 },
  clearRow: { alignItems: "center", paddingTop: 8 },
  clearLabel: { fontSize: 16, fontWeight: "600" },
})
