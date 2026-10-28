import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileConversationDetail, MobileMessage } from "@reswell/api-contract"
import { MessageComposerBar } from "@/components/message-composer-bar"
import { ProfileCircle } from "@/components/profile-circle"
import { SellUploadMenu } from "@/components/sell/sell-upload-menu"
import { fetchConversation, messageAttachmentUrl, sendConversationMediaMessage, sendConversationMessage } from "@/lib/api"
import { uploadConversationImageAttachment } from "@/lib/message-media-upload"
import { useAuth } from "@/lib/auth-context"
import { publicApiUrl } from "@/lib/public-env"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type ThreadRow = { kind: "day"; id: string; label: string } | { kind: "message"; message: MobileMessage }

export default function ConversationScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(true)
  const accessToken = session?.access_token ?? null
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing conversation"))
      return fetchConversation(id, token)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)

  return (
    <>
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <Stack.Screen
        options={{
          headerTitle: () => <ThreadTitle name={data?.other_name ?? "Messages"} avatarUrl={data?.other_avatar_url ?? null} joined={data?.other_joined_label ?? null} />,
        }}
      />
      {loading && !data ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : error && !data ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.foreground, fontFamily: fontFamily.text }}>{error}</Text>
          <Pressable onPress={reload}>
            <Text style={[styles.retry, { color: colors.foreground, fontFamily: fontFamily.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : data ? (
        <>
          {data.listing_id ? (
            <Pressable
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: data.listing_slug || data.listing_id || "" } })}
              style={[styles.listing, { borderColor: colors.border }]}
            >
              {data.listing_image_url ? (
                <Image source={{ uri: data.listing_image_url }} style={[styles.listingImage, { backgroundColor: colors.image }]} contentFit="cover" />
              ) : (
                <View style={[styles.listingImage, { backgroundColor: colors.image }]} />
              )}
              <Text numberOfLines={1} style={[styles.listingTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {data.listing_title ?? "Listing"}
              </Text>
              <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
            </Pressable>
          ) : null}
          <FlatList
            data={threadRows(data.messages)}
            keyExtractor={(item) => (item.kind === "day" ? item.id : item.message.id)}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={reload}
            ListHeaderComponent={<PersonSummary conversation={data} />}
            renderItem={({ item }) =>
              item.kind === "day" ? (
                <Text style={[styles.day, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.label}</Text>
              ) : (
                <MessageRow
                  message={item.message}
                  accessToken={accessToken}
                  avatarUrl={data.other_avatar_url}
                  name={data.other_name}
                  viewerIsSeller={data.viewer_is_seller}
                  onOpenOrder={(orderId) => {
                    if (data.viewer_is_seller) {
                      router.push({ pathname: "/account/sales/[id]", params: { id: orderId } })
                      return
                    }
                    router.push("/account/purchases")
                  }}
                />
              )
            }
          />
          {safetyOpen ? (
            <View style={[styles.safety, { borderColor: colors.border }]}>
              <SymbolView name={{ ios: "shield.fill", android: "shield", web: "shield" }} size={18} tintColor={colors.shipping} />
              <Text style={[styles.safetyText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Keep it on Reswell. Only chat in the app and never share info like your email or phone number.{" "}
                <Text style={styles.safetyLink} onPress={() => void Linking.openURL(`${publicApiUrl()}/safety`)}>
                  Get safety tips
                </Text>
              </Text>
              <Pressable onPress={() => setSafetyOpen(false)} accessibilityLabel="Dismiss safety note">
                <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={14} tintColor={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <MessageComposerBar
            draft={draft}
            onChangeText={setDraft}
            sending={sending || uploadingPhoto}
            sendDisabled={uploadingPhoto}
            placeholder="Write a private message..."
            paddingBottom={Math.max(insets.bottom, 12)}
            error={sendError}
            onSend={() => {
              const token = accessToken
              const body = draft.trim()
              if (!token || !id || !body) return
              setSending(true)
              setSendError(null)
              sendConversationMessage(token, id, body)
                .then(() => {
                  setDraft("")
                  reload()
                })
                .catch((cause: unknown) => {
                  setSendError(cause instanceof Error ? cause.message : "Could not send that message")
                })
                .finally(() => setSending(false))
            }}
            leading={
              <Pressable
                disabled={sending || uploadingPhoto}
                accessibilityLabel="Add photo"
                onPress={() => {
                  if (!id || !accessToken) return
                  setPhotoMenuOpen(true)
                }}
                style={styles.attach}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <SymbolView
                    name={{ ios: "photo.on.rectangle", android: "photo_library", web: "photo_library" }}
                    size={20}
                    tintColor={colors.foreground}
                  />
                )}
              </Pressable>
            }
          />
        </>
      ) : null}
    </KeyboardAvoidingView>
    {photoMenuOpen && id && accessToken ? (
      <SellUploadMenu
        onClose={() => setPhotoMenuOpen(false)}
        onLibrary={() => {
          setPhotoMenuOpen(false)
          void sendConversationPhoto({
            source: "library",
            conversationId: id,
            accessToken,
            caption: draft,
            onCaptionClear: () => setDraft(""),
            onError: setSendError,
            onStart: () => {
              setUploadingPhoto(true)
              setSendError(null)
            },
            onFinish: () => setUploadingPhoto(false),
            onSent: reload,
          })
        }}
        onCamera={() => {
          setPhotoMenuOpen(false)
          void sendConversationPhoto({
            source: "camera",
            conversationId: id,
            accessToken,
            caption: draft,
            onCaptionClear: () => setDraft(""),
            onError: setSendError,
            onStart: () => {
              setUploadingPhoto(true)
              setSendError(null)
            },
            onFinish: () => setUploadingPhoto(false),
            onSent: reload,
          })
        }}
      />
    ) : null}
    </>
  )
}

function ThreadTitle({ name, avatarUrl, joined }: { name: string; avatarUrl: string | null; joined: string | null }) {
  const colors = useReswellColors()
  return (
    <View style={styles.titleRow}>
      <ProfileCircle url={avatarUrl} size={32} />
      <View>
        <Text numberOfLines={1} style={[styles.titleName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          {name}
        </Text>
        {joined ? (
          <Text numberOfLines={1} style={[styles.titleMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {joined}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function PersonSummary({ conversation }: { conversation: MobileConversationDetail }) {
  const colors = useReswellColors()
  const reviews =
    conversation.other_review_count === 0
      ? "No reviews yet"
      : `${conversation.other_rating_average?.toFixed(1) ?? ""} · ${conversation.other_review_count} reviews`
  return (
    <View style={styles.person}>
      <ProfileCircle url={conversation.other_avatar_url} size={72} />
      <Text style={[styles.personName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{conversation.other_name}</Text>
      {conversation.other_joined_label ? (
        <Text style={[styles.personMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>{conversation.other_joined_label}</Text>
      ) : null}
      <View style={styles.reviewLine}>
        <SymbolView name={{ ios: "star.fill", android: "star", web: "star" }} size={12} tintColor={colors.foreground} />
        <Text style={[styles.personMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>{reviews}</Text>
      </View>
    </View>
  )
}

async function sendConversationPhoto(opts: {
  source: "library" | "camera"
  conversationId: string
  accessToken: string
  caption: string
  onCaptionClear: () => void
  onError: (message: string) => void
  onStart: () => void
  onFinish: () => void
  onSent: () => void
}) {
  opts.onStart()
  try {
    const asset = opts.source === "camera" ? await pickCameraPhoto() : await pickLibraryPhoto()
    if (!asset) return
    const attachment = await uploadConversationImageAttachment(opts.conversationId, {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    })
    const caption = opts.caption.trim()
    await sendConversationMediaMessage(opts.accessToken, opts.conversationId, {
      attachment,
      ...(caption ? { caption } : {}),
    })
    if (caption) opts.onCaptionClear()
    opts.onSent()
  } catch (cause: unknown) {
    opts.onError(cause instanceof Error ? cause.message : "Could not send that photo")
  } finally {
    opts.onFinish()
  }
}

async function pickLibraryPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) throw new Error("Photo access is off. Enable it in Settings to send photos.")
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 })
  if (result.canceled || !result.assets[0]) return null
  return result.assets[0]
}

async function pickCameraPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) throw new Error("Camera access is off. Enable it in Settings to take photos.")
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
  if (result.canceled || !result.assets[0]) return null
  return result.assets[0]
}

function MessageRow({
  message,
  accessToken,
  avatarUrl,
  name,
  viewerIsSeller,
  onOpenOrder,
}: {
  message: MobileMessage
  accessToken: string | null
  avatarUrl: string | null
  name: string
  viewerIsSeller: boolean
  onOpenOrder: (orderId: string) => void
}) {
  const colors = useReswellColors()
  const time = timeLabel(message.created_at)
  if (message.order) {
    const order = message.order
    return (
      <View style={[styles.orderWrap, message.mine ? styles.mine : styles.theirs]}>
        <View style={[styles.orderCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.orderKicker, { color: colors.muted, fontFamily: fontFamily.text }]}>Order placed</Text>
          <Text style={[styles.orderNum, { color: colors.foreground, fontFamily: fontFamily.text }]}>#{order.order_num}</Text>
          {order.items.map((item, index) => (
            <Text key={`${order.order_id}-${index}`} style={[styles.orderItem, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {order.items.length > 1 ? `• ${item}` : item}
            </Text>
          ))}
          <Text style={[styles.orderTotal, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{order.total_label}</Text>
          <Text style={[styles.orderMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {order.payment_label} · {order.fulfillment_label}
          </Text>
          <Text style={[styles.orderMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>{order.hint}</Text>
          <Pressable onPress={() => onOpenOrder(order.order_id)} style={[styles.orderButton, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.orderButtonLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {viewerIsSeller ? "View sale" : "View purchases"}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.time, message.mine ? styles.timeMine : null, { color: colors.muted, fontFamily: fontFamily.text }]}>{time}</Text>
      </View>
    )
  }
  const imageAttachment = message.attachment?.kind === "image"
  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined

  return (
    <View style={[styles.messageRow, message.mine ? styles.mine : styles.theirs]}>
      {message.mine ? null : <ProfileCircle url={avatarUrl} size={28} />}
      <View style={styles.bubbleWrap}>
        <View style={[styles.bubble, imageAttachment ? styles.mediaBubble : null, { borderColor: colors.border, backgroundColor: message.mine ? colors.image : colors.background }]}>
          {imageAttachment ? (
            <Image
              source={{ uri: messageAttachmentUrl(message.id), headers: authHeaders }}
              style={[styles.messageImage, { backgroundColor: colors.image }]}
              contentFit="cover"
            />
          ) : null}
          {message.body ? (
            <Text style={[styles.body, imageAttachment ? styles.mediaCaption : null, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {message.body}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.time, message.mine ? styles.timeMine : null, { color: colors.muted, fontFamily: fontFamily.text }]}>{time}</Text>
      </View>
    </View>
  )
}

function threadRows(messages: MobileMessage[]): ThreadRow[] {
  const rows: ThreadRow[] = []
  let lastDay = ""
  for (const message of messages) {
    const label = dayLabel(message.created_at)
    if (label !== lastDay) {
      rows.push({ kind: "day", id: `day-${message.id}`, label })
      lastDay = label
    }
    rows.push({ kind: "message", message })
  }
  return rows
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(",", "")
}

function timeLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  retry: { fontSize: 16, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 220 },
  titleName: { fontSize: 16, fontWeight: "700" },
  titleMeta: { fontSize: 12 },
  listing: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  listingImage: { width: 40, height: 40, borderRadius: 6 },
  listingTitle: { flex: 1, fontSize: 15, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  person: { alignItems: "center", gap: 4, paddingTop: 12, paddingBottom: 20 },
  personName: { marginTop: 8, fontSize: 18, fontWeight: "700" },
  personMeta: { fontSize: 14 },
  reviewLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  day: { alignSelf: "center", marginTop: 8, fontSize: 13 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "86%" },
  bubbleWrap: { flexShrink: 1, gap: 4 },
  bubble: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  body: { fontSize: 16, lineHeight: 21 },
  time: { fontSize: 12 },
  timeMine: { textAlign: "right" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  orderWrap: { maxWidth: "86%", gap: 4 },
  orderCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, gap: 4 },
  orderKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  orderNum: { fontSize: 17, fontWeight: "700" },
  orderItem: { fontSize: 14, lineHeight: 18 },
  orderTotal: { marginTop: 4, fontSize: 20, fontWeight: "700" },
  orderMeta: { fontSize: 13, lineHeight: 18 },
  orderButton: { marginTop: 8, borderRadius: 12, alignItems: "center", paddingVertical: 10 },
  orderButtonLabel: { fontSize: 15, fontWeight: "700" },
  safety: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 12 },
  safetyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  safetyLink: { fontWeight: "700" },
  attach: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  mediaBubble: { paddingHorizontal: 4, paddingVertical: 4, overflow: "hidden" },
  messageImage: { width: 220, height: 220, borderRadius: 14 },
  mediaCaption: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
})
