import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileProfileAddress, MobileProfileSettings } from "@reswell/api-contract"
import { createProfileAddress, deleteProfileAddress, updateProfileAddress } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

type AddressDraft = {
  label: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
}

const EMPTY_DRAFT: AddressDraft = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  is_default: false,
}

function draftFromAddress(address: MobileProfileAddress): AddressDraft {
  return {
    label: address.label ?? "",
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postal_code: address.postal_code,
    country: address.country || "US",
    is_default: address.is_default,
  }
}

export function ProfileAddresses({
  settings,
  onSaved,
}: {
  settings: MobileProfileSettings
  onSaved: () => void
}) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [addresses, setAddresses] = useState(settings.addresses)
  const [editing, setEditing] = useState<MobileProfileAddress | null | "new">(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setAddresses(settings.addresses)
  }, [settings.addresses])

  function openAdd() {
    setMessage(null)
    setEditing("new")
  }

  function confirmDelete(address: MobileProfileAddress) {
    const token = session?.access_token
    if (!token) return
    Alert.alert("Delete this address?", "This cannot be undone. Checkout will ask for a new address if needed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setMessage(null)
          deleteProfileAddress(token, address.id)
            .then((page) => {
              setAddresses(page.addresses)
              onSaved()
            })
            .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to delete that address"))
        },
      },
    ])
  }

  function setDefault(address: MobileProfileAddress) {
    const token = session?.access_token
    if (!token || address.is_default) return
    setMessage(null)
    updateProfileAddress(token, address.id, { is_default: true })
      .then((page) => {
        setAddresses(page.addresses)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to update default"))
  }

  return (
    <View style={styles.list}>
      <Pressable
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel="Add address"
        style={[styles.add, { backgroundColor: colors.foreground }]}
      >
        <Text style={[styles.addLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
          Add address
        </Text>
      </Pressable>
      {addresses.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
          No shipping addresses yet. Add one to speed up checkout.
        </Text>
      ) : (
        addresses.map((address) => (
          <View key={address.id} style={[styles.card, { borderColor: colors.border }]}>
            <Pressable onPress={() => setEditing(address)} accessibilityRole="button" accessibilityLabel="Edit address">
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {address.label || address.full_name}
                {address.is_default ? " · Default" : ""}
              </Text>
              <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{address.line}</Text>
            </Pressable>
            <View style={styles.actions}>
              {address.is_default ? null : (
                <Pressable onPress={() => setDefault(address)} accessibilityRole="button" accessibilityLabel="Set as default">
                  <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    Set as default
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => setEditing(address)} accessibilityRole="button" accessibilityLabel="Edit address">
                <Text style={[styles.action, { color: colors.foreground, fontFamily: fontFamily.text }]}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(address)} accessibilityRole="button" accessibilityLabel="Delete address">
                <Text style={[styles.action, { color: colors.destructive, fontFamily: fontFamily.text }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      {message ? (
        <Text style={[styles.message, { color: colors.destructive, fontFamily: fontFamily.text }]}>{message}</Text>
      ) : null}
      <AddressFormSheet
        open={editing !== null}
        title={editing && editing !== "new" ? "Edit shipping address" : "Add shipping address"}
        draft={
          editing && editing !== "new"
            ? draftFromAddress(editing)
            : { ...EMPTY_DRAFT, is_default: addresses.length === 0 }
        }
        editingId={editing && editing !== "new" ? editing.id : null}
        onClose={() => setEditing(null)}
        onSaved={(page) => {
          setAddresses(page.addresses)
          setEditing(null)
          onSaved()
        }}
      />
    </View>
  )
}

function AddressFormSheet({
  open,
  title,
  draft: initial,
  editingId,
  onClose,
  onSaved,
}: {
  open: boolean
  title: string
  draft: AddressDraft
  editingId: string | null
  onClose: () => void
  onSaved: (page: { addresses: MobileProfileAddress[] }) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const seed = useRef(initial)
  seed.current = initial

  useEffect(() => {
    if (!open) return
    setDraft(seed.current)
    setError(null)
    setSaving(false)
  }, [open, editingId])

  function setField<K extends keyof AddressDraft>(field: K, value: AddressDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function save() {
    const token = session?.access_token
    if (!token || saving) return
    if (!draft.line1.trim() || !draft.city.trim() || !draft.postal_code.trim()) {
      setError("Street, city, and ZIP code are required.")
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      line1: draft.line1.trim(),
      line2: draft.line2.trim() || null,
      city: draft.city.trim(),
      state: draft.state.trim() || null,
      postal_code: draft.postal_code.trim(),
      country: draft.country.trim() || "US",
      label: draft.label.trim() || null,
      is_default: draft.is_default,
    }
    const request = editingId
      ? updateProfileAddress(token, editingId, payload)
      : createProfileAddress(token, payload)
    request
      .then(onSaved)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to save that address"))
      .finally(() => setSaving(false))
  }

  const fields = [
    ["label", "Nickname (optional)", "words"],
    ["line1", "Street address", "words"],
    ["line2", "Apt, suite, etc. (optional)", "words"],
    ["city", "City", "words"],
    ["state", "State", "characters"],
    ["postal_code", "ZIP code", "none"],
    ["country", "Country", "characters"],
  ] as const

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close address form">
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
          <View style={styles.sheetSpacer} />
        </View>
        <ScrollView
          style={styles.sheet}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.sheetList, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        >
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            Shipping location only — your name and phone come from personal information.
          </Text>
          {fields.map(([field, placeholder, capitalize]) => (
            <TextInput
              key={field}
              value={draft[field]}
              onChangeText={(value) => setField(field, value)}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize={capitalize}
              autoCorrect={capitalize !== "characters"}
              keyboardType={field === "postal_code" ? "numbers-and-punctuation" : "default"}
              accessibilityLabel={placeholder}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
            />
          ))}
          <View style={[styles.defaultRow, { borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Default</Text>
            <Switch value={draft.is_default} onValueChange={(value) => setField("is_default", value)} />
          </View>
          {error ? <Text style={[styles.message, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
          <Pressable
            disabled={saving}
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel="Save address"
            style={[styles.save, { backgroundColor: colors.foreground, opacity: saving ? 0.45 : 1 }]}
          >
            <Text style={[styles.addLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {saving ? "Saving…" : "Save address"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 22, gap: 8 },
  add: { minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  addLabel: { fontSize: 16, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24, fontSize: 15, lineHeight: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 8, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 4 },
  action: { fontSize: 14, fontWeight: "700" },
  message: { fontSize: 14, marginTop: 8 },
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetSpacer: { width: 18 },
  sheetList: { padding: 16, gap: 10, paddingBottom: 40 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  save: { borderRadius: 14, alignItems: "center", paddingVertical: 14, marginTop: 4 },
})
