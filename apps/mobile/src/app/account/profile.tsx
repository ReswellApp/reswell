import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { TextInput as GestureTextInput } from "react-native-gesture-handler"
import { SymbolView } from "expo-symbols"
import type { MobileProfileSettings } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import { ScreenScroll, ScreenShell } from "@/components/screen-shell"
import { ProfileCircle } from "@/components/profile-circle"
import {
  changeProfileEmail,
  changeProfilePassword,
  fetchProfileSettings,
  sendPushTest,
  removeProfileAvatar,
  removeProfileBanner,
  removeProfileTileBanner,
  saveProfileSettings,
  sendProfilePasswordReset,
  uploadProfileAvatar,
  uploadProfileBanner,
  uploadProfileTileBanner,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { requestPushPermissionAndRegister } from "@/lib/push-token"
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
        <ScreenShell>
          <ScreenScroll contentInsetAdjustmentBehavior="never">
            <TabBar tab={tab} onChange={setTab} />
            {tab === "shop" ? <ShopTab settings={data} onSaved={reload} /> : null}
            {tab === "sign-in" ? <SignInTab settings={data} /> : null}
            {tab === "addresses" ? <AddressesTab settings={data} /> : null}
            {tab === "notifications" ? <NotificationsTab settings={data} onSaved={reload} /> : null}
          </ScreenScroll>
        </ScreenShell>
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
  const [bannerUrl, setBannerUrl] = useState(settings.shop_banner_url)
  const [tileUrl, setTileUrl] = useState(settings.shop_tile_banner_url)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [bannerBusy, setBannerBusy] = useState<"banner" | "tile" | null>(null)
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

  async function pickBanner(kind: "banner" | "tile") {
    const token = session?.access_token
    if (!token || bannerBusy) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setMessage("Photo access is off. Enable it in Settings to add a photo.")
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 })
    if (picked.canceled || !picked.assets[0]) return
    setBannerBusy(kind)
    setMessage(null)
    const upload = kind === "banner" ? uploadProfileBanner : uploadProfileTileBanner
    upload(token, picked.assets[0].uri)
      .then((result) => {
        if (kind === "banner") setBannerUrl(result.banner_url)
        else setTileUrl(result.banner_url)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to update that photo"))
      .finally(() => setBannerBusy(null))
  }

  function removeBanner(kind: "banner" | "tile") {
    const token = session?.access_token
    if (!token || bannerBusy) return
    setBannerBusy(kind)
    setMessage(null)
    const remove = kind === "banner" ? removeProfileBanner : removeProfileTileBanner
    remove(token)
      .then(() => {
        if (kind === "banner") setBannerUrl(null)
        else setTileUrl(null)
        onSaved()
      })
      .catch((cause: unknown) => setMessage(cause instanceof Error ? cause.message : "Unable to remove that photo"))
      .finally(() => setBannerBusy(null))
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
        <ProfileCircle url={avatarUrl} size={96} />
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

      <Banner
        title="Seller banner"
        hint="The wide photo at the top of your shop."
        url={bannerUrl}
        busy={bannerBusy === "banner"}
        onAdd={() => void pickBanner("banner")}
        onRemove={() => removeBanner("banner")}
      />
      <Banner
        title="Tile banner"
        hint="The photo on your shop tile."
        url={tileUrl}
        busy={bannerBusy === "tile"}
        onAdd={() => void pickBanner("tile")}
        onRemove={() => removeBanner("tile")}
      />

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

function Banner({
  title,
  hint,
  url,
  busy,
  onAdd,
  onRemove,
}: {
  title: string
  hint: string
  url: string | null
  busy: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const colors = useReswellColors()
  return (
    <View style={[styles.bannerBlock, { borderTopColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{hint}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add photo for ${title}`} disabled={busy} onPress={onAdd}>
        {url ? (
          <Image source={{ uri: url }} style={[styles.banner, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.banner, styles.bannerEmpty, { backgroundColor: colors.image }]}>
            <SymbolView name={{ ios: "photo", android: "image", web: "image" }} size={22} tintColor={colors.muted} />
            <Text style={[styles.bannerAdd, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {busy ? "Adding…" : "Add photo"}
            </Text>
          </View>
        )}
      </Pressable>
      {url ? (
        <View style={styles.photoActions}>
          <Pressable onPress={onAdd} disabled={busy}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>{busy ? "Adding…" : "Change photo"}</Text>
          </Pressable>
          <Pressable onPress={onRemove} disabled={busy}>
            <Text style={[styles.link, { color: colors.muted, fontFamily: fontFamily.text }]}>Remove photo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

function SignInTab({ settings }: { settings: MobileProfileSettings }) {
  const colors = useReswellColors()
  const { session, signOut } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState(settings.email ?? "")
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [busy, setBusy] = useState<"email" | "password" | "reset" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<"ok" | "error">("error")

  function note(tone: "ok" | "error", text: string) {
    setMessageTone(tone)
    setMessage(text)
  }

  async function updateEmail() {
    const token = session?.access_token
    if (!token || busy) return
    setBusy("email")
    setMessage(null)
    try {
      await changeProfileEmail(token, { email: email.trim() })
      note("ok", "Check your inbox to confirm the new email.")
    } catch (cause) {
      note("error", cause instanceof Error ? cause.message : "Couldn't update your email.")
    } finally {
      setBusy(null)
    }
  }

  async function savePassword() {
    const token = session?.access_token
    if (!token || busy) return
    if (newPassword.length < 6) {
      note("error", "Password must be at least 6 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      note("error", "New passwords do not match.")
      return
    }
    setBusy("password")
    setMessage(null)
    try {
      await changeProfilePassword(token, { current_password: currentPassword, new_password: newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordOpen(false)
      note("ok", "Your password was updated.")
    } catch (cause) {
      note("error", cause instanceof Error ? cause.message : "Couldn't update your password.")
    } finally {
      setBusy(null)
    }
  }

  async function sendReset() {
    const token = session?.access_token
    if (!token || busy) return
    setBusy("reset")
    setMessage(null)
    try {
      await sendProfilePasswordReset(token)
      note("ok", "Check your email for a link to reset your password.")
    } catch (cause) {
      note("error", cause instanceof Error ? cause.message : "Couldn't send the reset email.")
    } finally {
      setBusy(null)
    }
  }

  const fieldStyle = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: fontFamily.text },
  ]

  return (
    <View style={styles.shop}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Login methods</Text>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{settings.email || "—"}</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {settings.signed_in_with === "google" ? "You signed in with Google" : "You signed in with email"}
        </Text>
        <Text style={[styles.cardTitle, styles.verified, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Email verification status
        </Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>Verified</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Change email address</Text>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.label, styles.labelInCard, { color: colors.foreground, fontFamily: fontFamily.text }]}>New email address</Text>
        <GestureTextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={fieldStyle}
        />
        <Pressable
          disabled={busy !== null || email.trim().length === 0}
          onPress={() => void updateEmail()}
          style={[styles.save, styles.saveInCard, { backgroundColor: colors.foreground, opacity: busy !== null ? 0.35 : 1 }]}
        >
          <Text style={[styles.saveLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
            {busy === "email" ? "Saving…" : "Update email"}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Change password</Text>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Change password</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          {settings.has_email_password
            ? "Enter your current password and choose a new one — no email link required."
            : "You sign in with Google or another provider on this account. Use “Email reset link” below if you want to add or reset an email-and-password login."}
        </Text>
        {settings.has_email_password ? (
          <>
            <Pressable
              onPress={() => setPasswordOpen((open) => !open)}
              style={[styles.outline, { borderColor: colors.border }]}
            >
              <Text style={[styles.saveLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {passwordOpen ? "Close" : "Enter new password"}
              </Text>
            </Pressable>
            {passwordOpen ? (
              <View style={styles.passwordFields}>
                <GestureTextInput
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="Current password"
                  placeholderTextColor={colors.muted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={fieldStyle}
                />
                <GestureTextInput
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="New password"
                  placeholderTextColor={colors.muted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={fieldStyle}
                />
                <GestureTextInput
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.muted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={fieldStyle}
                />
                <Pressable
                  disabled={busy !== null}
                  onPress={() => void savePassword()}
                  style={[styles.save, styles.saveInCard, { backgroundColor: colors.foreground, opacity: busy !== null ? 0.35 : 1 }]}
                >
                  <Text style={[styles.saveLabel, { color: colors.background, fontFamily: fontFamily.text }]}>
                    {busy === "password" ? "Saving…" : "Save new password"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Reset password</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          We'll email you a secure link to choose a new password for this account.
        </Text>
        <Pressable
          disabled={busy !== null || !settings.email}
          onPress={() => void sendReset()}
          style={[styles.outline, { borderColor: colors.border, opacity: busy !== null ? 0.35 : 1 }]}
        >
          <Text style={[styles.saveLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {busy === "reset" ? "Sending…" : "Email reset link"}
          </Text>
        </Pressable>
      </View>

      {message ? (
        <Text style={[styles.message, { color: messageTone === "ok" ? colors.foreground : colors.destructive, fontFamily: fontFamily.text }]}>
          {message}
        </Text>
      ) : null}

      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Sign out</Text>
        <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>Sign out of your account on this device</Text>
        <Pressable
          onPress={() => {
            void signOut().then(() => router.replace("/account"))
          }}
          style={[styles.outline, { borderColor: colors.border }]}
        >
          <Text style={[styles.saveLabel, { color: colors.destructive, fontFamily: fontFamily.text }]}>Sign out</Text>
        </Pressable>
      </View>
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

const PUSH_TOPIC_ROWS: Array<{
  key: "push_messages" | "push_offers" | "push_saves" | "push_follows" | "push_orders"
  title: string
  hint: string
}> = [
  { key: "push_messages", title: "Messages", hint: "New chats about your listings." },
  { key: "push_offers", title: "Offers", hint: "Offers you send and receive." },
  { key: "push_saves", title: "Saves", hint: "When someone saves your listing." },
  { key: "push_follows", title: "Following", hint: "New listings and price drops from people you follow." },
  { key: "push_orders", title: "Orders", hint: "Deliveries, payouts, and listing status." },
]

function pushTopicsFromSettings(settings: MobileProfileSettings) {
  return {
    push_messages: settings.push_messages,
    push_offers: settings.push_offers,
    push_saves: settings.push_saves,
    push_follows: settings.push_follows,
    push_orders: settings.push_orders,
  }
}

function NotificationsTab({ settings, onSaved }: { settings: MobileProfileSettings; onSaved: () => void }) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [smsEnabled, setSmsEnabled] = useState(settings.message_sms_opt_in)
  const [topics, setTopics] = useState(pushTopicsFromSettings(settings))
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const pushEnabled = Object.values(topics).some(Boolean)

  useEffect(() => {
    setTopics(pushTopicsFromSettings(settings))
    setSmsEnabled(settings.message_sms_opt_in)
  }, [settings])

  return (
    <View style={styles.shop}>
      <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Choose how Reswell reaches you about messages and activity.
      </Text>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>App</Text>
      {PUSH_TOPIC_ROWS.map((row) => (
        <View key={row.key} style={[styles.card, styles.notifyRow, { borderColor: colors.border }]}>
          <View style={styles.notifyCopy}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{row.title}</Text>
            <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{row.hint}</Text>
          </View>
          <Switch
            value={topics[row.key]}
            onValueChange={(next) => {
              const token = session?.access_token
              if (!token) return
              const previous = topics[row.key]
              const turningFirstOn = next && !Object.values(topics).some(Boolean)
              setTopics((current) => ({ ...current, [row.key]: next }))
              setMessage(null)
              setMessageOk(false)
              const save = async () => {
                if (turningFirstOn) {
                  const permission = await requestPushPermissionAndRegister(token)
                  if (!permission.ok) throw new Error(permission.error)
                }
                await saveProfileSettings(token, { display_name: settings.display_name, [row.key]: next })
                onSaved()
              }
              save().catch((cause: unknown) => {
                setTopics((current) => ({ ...current, [row.key]: previous }))
                setMessage(cause instanceof Error ? cause.message : "Unable to update alerts")
              })
            }}
          />
        </View>
      ))}
      {pushEnabled ? (
        <Pressable
          onPress={() => {
            const token = session?.access_token
            if (!token || testBusy) return
            setTestBusy(true)
            setMessage(null)
            setMessageOk(false)
            sendPushTest(token)
              .then(() => {
                setMessageOk(true)
                setMessage("Test alert sent. Check this iPhone.")
              })
              .catch((cause: unknown) => {
                setMessageOk(false)
                setMessage(cause instanceof Error ? cause.message : "Unable to send a test alert")
              })
              .finally(() => setTestBusy(false))
          }}
          style={[styles.outline, { borderColor: colors.border, marginTop: 8 }]}
        >
          <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {testBusy ? "Sending…" : "Send a test alert"}
          </Text>
        </Pressable>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Messages</Text>
      <View style={[styles.card, styles.notifyRow, { borderColor: colors.border }]}>
        <View style={styles.notifyCopy}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Text alerts</Text>
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>{settings.sms_phone || "Add a phone number on an address first."}</Text>
        </View>
        <Switch
          value={smsEnabled}
          onValueChange={(next) => {
            const token = session?.access_token
            if (!token) return
            setSmsEnabled(next)
            setMessage(null)
            setMessageOk(false)
            saveProfileSettings(token, { display_name: settings.display_name, message_sms_opt_in: next })
              .then(() => onSaved())
              .catch((cause: unknown) => {
                setSmsEnabled(!next)
                setMessage(cause instanceof Error ? cause.message : "Unable to update alerts")
              })
            }}
          />
        </View>
      {message ? (
        <Text style={[styles.message, { color: messageOk ? colors.foreground : colors.destructive, fontFamily: fontFamily.text }]}>
          {message}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 22, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingTop: 8 },
  tabLabel: { fontSize: 15, fontWeight: "600" },
  tabMark: { height: 2, marginTop: 10, borderRadius: 2 },
  shop: { paddingHorizontal: 20, paddingTop: 22, gap: 8 },
  avatarWrap: { alignSelf: "center", marginBottom: 4 },
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
  banner: { height: 96, borderRadius: 12, marginTop: 8, overflow: "hidden" },
  bannerEmpty: { alignItems: "center", justifyContent: "center", gap: 6 },
  bannerAdd: { fontSize: 15, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 8 },
  hint: { fontSize: 14, lineHeight: 20 },
  message: { fontSize: 14, marginTop: 8 },
  save: { marginTop: 16, minHeight: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  saveLabel: { fontSize: 16, fontWeight: "700" },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 4, marginTop: 8 },
  labelInCard: { marginTop: 0 },
  saveInCard: { marginTop: 8 },
  outline: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  passwordFields: { gap: 8, marginTop: 8 },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  verified: { marginTop: 12 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  notifyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifyCopy: { flex: 1, gap: 4 },
})
