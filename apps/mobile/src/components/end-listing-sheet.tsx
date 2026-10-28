import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { fontFamily, useReswellColors } from "@/theme"

export type EndListingChoice = "vacation" | "mark_sold" | "delete"

export function EndListingSheet({
  visible,
  onClose,
  listingStatus,
  onMarkSold,
  onDelete,
  canDelete,
  onVacation,
  vacationMode,
}: {
  visible: boolean
  onClose: () => void
  listingStatus: string
  canDelete: boolean
  vacationMode: boolean
  onVacation: () => Promise<void>
  onMarkSold: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const [choice, setChoice] = useState<EndListingChoice | null>(null)
  const [busy, setBusy] = useState(false)

  const canVacation = listingStatus === "active" || listingStatus === "pending_sale"

  function reset() {
    setChoice(null)
    setBusy(false)
  }

  function dismiss() {
    reset()
    onClose()
  }

  async function continueWithChoice() {
    if (!choice || busy) return
    setBusy(true)
    try {
      if (choice === "vacation") await onVacation()
      else if (choice === "mark_sold") await onMarkSold()
      else if (choice === "delete") await onDelete()
      dismiss()
    } catch (cause: unknown) {
      setBusy(false)
      if (cause instanceof Error && cause.message === "Cancelled") return
    }
  }

  const continueLabel =
    choice === "vacation"
      ? vacationMode
        ? "Go live"
        : "Turn on vacation"
      : choice === "delete"
        ? "Continue"
        : choice === "mark_sold"
          ? "Continue"
          : "Continue"

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>End listing</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={dismiss} hitSlop={8}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
        </View>
        <Text style={[styles.description, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {canVacation ? "Vacation mode temporarily hides a live listing until you go live again. " : null}
          {canDelete
            ? "Delete removes the listing immediately."
            : "This listing is tied to an order or payment, so it cannot be permanently deleted."}{" "}
          Mark as sold keeps it on file when you closed the sale elsewhere.
        </Text>
        <View style={styles.options}>
          {canVacation ? (
            <OptionRow
              selected={choice === "vacation"}
              title={vacationMode ? "Go live" : "Vacation mode"}
              subtitle={vacationMode ? "Show on the site again" : "(temporarily hide)"}
              onPress={() => setChoice("vacation")}
            />
          ) : null}
          <OptionRow
            selected={choice === "mark_sold"}
            title="Mark as sold"
            onPress={() => setChoice("mark_sold")}
          />
          {canDelete ? (
            <OptionRow
              selected={choice === "delete"}
              title="Delete listing"
              destructive
              onPress={() => setChoice("delete")}
            />
          ) : null}
        </View>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={dismiss}
            disabled={busy}
            style={[styles.footerButton, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <Text style={[styles.footerLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => void continueWithChoice()}
            disabled={!choice || busy}
            style={[
              styles.footerButton,
              styles.footerPrimary,
              {
                backgroundColor: choice === "delete" ? colors.destructive : colors.primary,
                opacity: !choice || busy ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.footerLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                {continueLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function OptionRow({
  title,
  subtitle,
  selected,
  destructive,
  onPress,
}: {
  title: string
  subtitle?: string
  selected: boolean
  destructive?: boolean
  onPress: () => void
}) {
  const colors = useReswellColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.image : colors.background,
        },
      ]}
    >
      <Text
        style={[
          styles.optionTitle,
          { color: destructive ? colors.destructive : colors.foreground, fontFamily: fontFamily.text },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.optionSubtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{subtitle}</Text>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  options: { gap: 10, flex: 1 },
  option: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: "600" },
  optionSubtitle: { fontSize: 13 },
  footer: { flexDirection: "row", gap: 10, paddingTop: 12 },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrimary: { borderWidth: 0 },
  footerLabel: { fontSize: 16, fontWeight: "600" },
})
