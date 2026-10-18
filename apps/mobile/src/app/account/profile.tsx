import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { MobileProfileSettings } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import {
  fetchProfileSettings,
  removeProfileAvatar,
  saveProfileSettings,
  uploadProfileAvatar,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type ProfileTab = "shop" | "sign-in" | "addresses" | "notifications"

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "sign-in", label: "Sign-in" },
  { id: "addresses", label: "Addresses" },
  { id: "notifications", label: "Notifications" },
]

export default function AccountProfileScreen() {
  const load = useCallback((accessToken: string) => fetchProfileSettings(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [tab, setTab] = useState<ProfileTab>("shop")

  return (
    <AccountState
      title="Profile"
      loading={loading && !data}
      error={error}
      onRetry={reload}
      empty="Profile is not available."
      isEmpty={!data}
    >
      {data ? (
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <TabBar tab={tab} onChange={setTab} />
          {tab === "shop" ? <ShopTab settings={data} onSaved={reload} /> : null}
          {tab === "sign-in" ? <SignInTab settings={data} /> : null}
          {tab === "addresses" ? <AddressesTab settings={data} /> : null}
          {tab === "notifications" ? <NotificationsTab settings={data} onSaved={reload} /> : null}
        </ScrollView>
      ) : null}
    </AccountState>
  )
}

function TabBar({ tab, onChange }: { tab: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
      {TABS.map((item) => {
        const active = item.id === tab
        return (
          <Pressable key={item.id} onPress={() => onChange(item.id)} style={styles.tab}>
            <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.muted, fontFamily: fontFamily.text }]}>
              {item.label}
            </Text>
            <View style={[styles.tabMark, { backgroundColor: active ? colors.foreground : "transparent" }]} />
          </Pressable>
        )
      })}
    </View>
  )
}

function ShopTab({ settings, onSaved }: { settings: MobileProfileSettings; onSaved: () => void }) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [name, setName] = useState(settings.display_name)
  const [bio, setBio] = useState(settings.bio ?? "")
  const [location, setLocation] = useState(settings.location ?? "")
  const [city, setCity] = useState(settings.city ?? "")
  const [avatarUrl, setAvatarUrl] = useState(settings.avatar_url)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function pickPhoto() {
    const token = session?.access_token
    if (!token || photoBusy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setMessage("Photo access is off. Enable it in Settings to change your photo.")
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 })
    if (picked.canceled || !picked.assets[0]) return
    setPhotoBusy(true)
    setMessage(null)
    uploadProfileAvatar(token, picked.assets[0].uri)
      .then((result) => {
        setAvatarUrl(result.avatar_url)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to update your photo"))
      .finally(() => setPhotoBusy(false))
  }

  function removePhoto() {
    const token = session?.access_token
    if (!token || photoBusy) return
    setPhotoBusy(true)
    setMessage(null)
    removeProfileAvatar(token)
      .then(() => {
        setAvatarUrl(null)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to remove your photo"))
      .finally(() => setPhotoBusy(false))
  }

  function save() {
    const token = session?.access_token
    if (!token || saving) return
    setSaving(true)
    setSaved(false)
    setMessage(null)
    saveProfileSettings(token, { display_name: name, bio, location, city })
      .then(() => {
        setSaved(true)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to save your profile"))
      .finally(() => setSaving(false))
  }

  return (
    <View style={styles.shop}>
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: colors.image }]}>
            <SymbolView name={{ ios: "person", android: "person", web: "person" }} size={40} tintColor={colors.muted} />
          </View>
        )}
        <Pressable
          accessibilityLabel="Edit photo"
          onPress={() => void pickPhoto()}
          style={[styles.pencil, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <SymbolView name={{ ios: "pencil", android: "edit", web: "edit" }} size={14} tintColor={colors.foreground} />
        </Pressable>
      </View>
      {avatarUrl ? (
        <View style={styles.photoActions}>
          <Pressable onPress={() => void pickPhoto()} disabled={photoBusy}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>{photoBusy ? "Updating…" : "Edit photo"}</Text>
          </Pressable>
          <Pressable onPress={removePhoto} disabled={photoBusy}>
            <Text style={[styles.link, { color: colors.muted, fontFamily: fontFamily.text }]}>Remove photo</Text>
          </Pressable>
        </View>
      ) : null}

      <FieldLabel
        label="Display Name"
        action={settings.seller_slug ? "See my store" : null}
        onAction={
          settings.seller_slug
            ? () => router.push({ pathname: "/profile/[slug]", params: { slug: settings.seller_slug ?? "" } })
            : undefined
        }
      />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Display name"
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
      />

      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>My username</Text>
      <TextInput
        value={settings.seller_slug ?? ""}
        editable={false}
        style={[styles.input, styles.readonly, { color: colors.muted, borderColor: colors.border, backgroundColor: colors.image, fontFamily: fontFamily.text }]}
      />

      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Tell buyers about your shop"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.bio, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
      />
      <View style={styles.split}>
        <View style={styles.splitField}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Location"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
        </View>
        <View style={styles.splitField}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>City</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
          />
        </View>
      </View>

      <Banner title="Seller banner" hint="The wide photo at the top of your shop." url={settings.shop_banner_url} />
      <Banner title="Tile banner" hint="The photo on your shop tile." url={settings.shop_tile_banner_url} />

      {message ? <Text style={[styles.message, { color: colors.destructive, fontFamily: fontFamily.text }]}>{message}</Text> : null}
      <Pressable onPress={save} disabled={saving} style={[styles.save, { backgroundColor: saving || saved ? colors.border : colors.primary }]}>
        <Text style={[styles.saveLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
          {saving ? "Saving" : saved ? "Saved" : "Save"}
        </Text>
      </Pressable>
    </View>
  )
}

function FieldLabel({ label, action, onAction }: { label: string; action: string | null; onAction?: () => void }) {
  const colors = useReswellColors()
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.storeLink}>
          <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>{action}</Text>
          <SymbolView name={{ ios: "arrow.up.right.square", android: "open_in_new", web: "open_in_new" }} size={14} tintColor={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  )
}

function Banner({ title, hint, url }: { title: string; hint: string; url: string | null }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.bannerBlock, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{hint}</Text>
      {url ? <Image source={{ uri: url }} style={[styles.banner, { backgroundColor: colors.image }]} contentFit="cover" /> : <View style={[styles.banner, { backgroundColor: colors.image }]} />}
    </View>
  )
}

function SignInTab({ settings }: { settings: MobileProfileSettings }) {
  const colors = useReswellColors()
  const { signOut } = useAuth()
  const router = useRouter()
  return (
    <View style={styles.shop}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Login methods</Text>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{settings.email || "—"}</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {settings.signed_in_with === "google" ? "Signed in with Google" : "Signed in with email"}
        </Text>
        <Text style={[styles.cardTitle, styles.verified, { color: colors.foreground, fontFamily: fontFamily.text }]}>Email verification</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>Verified</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Change email</Text>
      <TextInput
        value={settings.email ?? ""}
        editable={false}
        style={[styles.input, styles.readonly, { color: colors.muted, borderColor: colors.border, backgroundColor: colors.image, fontFamily: fontFamily.text }]}
      />
      <Pressable
        onPress={() => {
          void signOut().then(() => router.replace("/account"))
        }}
        style={[styles.save, { backgroundColor: colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}
      >
        <Text style={[styles.saveLabel, { color: colors.destructive, fontFamily: fontFamily.text }]}>Sign out</Text>
      </Pressable>
    </View>
  )
}

function AddressesTab({ settings }: { settings: MobileProfileSettings }) {
  const colors = useReswellColors()
  if (settings.addresses.length === 0) {
    return <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>No saved addresses yet.</Text>
  }
  return (
    <View style={styles.shop}>
      {settings.addresses.map((address) => (
        <View key={address.id} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {address.label || address.full_name}
            {address.is_default ? " · Default" : ""}
          </Text>
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{address.line}</Text>
        </View>
      ))}
    </View>
  )
}

function NotificationsTab({ settings, onSaved }: { settings: MobileProfileSettings; onSaved: () => void }) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [enabled, setEnabled] = useState(settings.message_sms_opt_in)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <View style={styles.shop}>
      <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Choose how Reswell reaches you about messages.
      </Text>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Messages</Text>
      <View style={[styles.card, styles.notifyRow, { borderColor: colors.border }]}>
        <View style={styles.notifyCopy}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Text alerts</Text>
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{settings.sms_phone || "Add a phone number on an address first."}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(next) => {
            const token = session?.access_token
            if (!token) return
            setEnabled(next)
            setMessage(null)
            saveProfileSettings(token, { display_name: settings.display_name, message_sms_opt_in: next })
              .then(() => onSaved())
              .catch((cause: unknown) => {
                setEnabled(!next)
                setMessage(cause instanceof Error ? cause.message : "Unable to update alerts")
              })
          }}
        />
      </View>
      {message ? <Text style={[styles.message, { color: colors.destructive, fontFamily: fontFamily.text }]}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingBottom: 140 },
  tabs: { flexDirection: "row", gap: 22, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingTop: 8 },
  tabLabel: { fontSize: 15, fontWeight: "600" },
  tabMark: { height: 2, marginTop: 10, borderRadius: 2 },
  shop: { paddingHorizontal: 20, paddingTop: 22, gap: 8 },
  avatarWrap: { alignSelf: "center", marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  pencil: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: { flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  storeLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 10 },
  link: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 44, paddingHorizontal: 12, fontSize: 16 },
  readonly: {},
  bio: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  split: { flexDirection: "row", gap: 12 },
  splitField: { flex: 1 },
  bannerBlock: { marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  banner: { height: 96, borderRadius: 12, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 8 },
  hint: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 14, marginTop: 8 },
  save: { marginTop: 16, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  saveLabel: { fontSize: 16, fontWeight: "700" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 4, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  verified: { marginTop: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  notifyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifyCopy: { flex: 1, gap: 4 },
})
