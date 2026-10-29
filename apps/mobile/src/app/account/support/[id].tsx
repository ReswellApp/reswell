import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { useLocalSearchParams } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileSupportMessage } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import { MessageComposerBar } from "@/components/message-composer-bar"
import { SellUploadMenu } from "@/components/sell/sell-upload-menu"
import { fetchSupportThread, replySupportCase, sendSupportMediaMessage, supportCaseMessageAttachmentUrl } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useInboxUnreadReload } from "@/lib/inbox-unread-count"
import { useAccountResource } from "@/lib/use-account-resource"
import { uploadSupportCaseImageAttachment } from "@/lib/support-case-media-upload"
import { fontFamily, useReswellColors } from "@/theme"

export default function SupportThreadScreen() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const accessToken = session?.access_token ?? null
  const load = useCallback(
    (token: string) => {
      if (!id) return Promise.reject(new Error("Missing case"))
      return fetchSupportThread(token, id)
    },
    [id],
  )
  const { data, error, loading, reload } = useAccountResource(load)
  const reloadUnread = useInboxUnreadReload()
  const messages = data?.messages ?? []

  useEffect(() => {
    if (!data) return
    reloadUnread()
  }, [data, reloadUnread])
  const composerBottom = Math.max(insets.bottom, 12)

  const sendMessage = () => {
    const token = accessToken
    const body = draft.trim()
    if (!token || !id || !body || sending || uploadingPhoto) return
    setSending(true)
    setSendError(null)
    void replySupportCase(token, id, body)
      .then(() => {
        setDraft("")
        reload()
      })
      .catch((cause: unknown) => {
        setSendError(cause instanceof Error ? cause.message : "Unable to send")
      })
      .finally(() => setSending(false))
  }

  return (
    <AccountState
      title="Reswell help"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No messages in this thread yet."
      isEmpty={messages.length === 0 && !data}
      edgeToEdgeBottom
    >
      <KeyboardAvoidingView
        style={[styles.thread, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {data?.closed ? "No messages in this thread." : "No messages yet. Send one below."}
            </Text>
          }
          renderItem={({ item }) => (
            <SupportMessageBubble message={item} accessToken={accessToken} colors={colors} />
          )}
        />
        {data?.closed ? (
          <Text style={[styles.closed, { color: colors.muted, fontFamily: fontFamily.text, paddingBottom: composerBottom }]}>
            This help thread is closed.
          </Text>
        ) : (
          <MessageComposerBar
            draft={draft}
            onChangeText={setDraft}
            onSend={sendMessage}
            sending={sending || uploadingPhoto}
            sendDisabled={uploadingPhoto}
            placeholder="Message Reswell help"
            paddingBottom={composerBottom}
            error={sendError}
            leading={
              <Pressable
                disabled={sending || uploadingPhoto || !id || !accessToken}
                accessibilityLabel="Add photo"
                onPress={() => setPhotoMenuOpen(true)}
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
        )}
      </KeyboardAvoidingView>
      {photoMenuOpen && id && accessToken ? (
        <SellUploadMenu
          onClose={() => setPhotoMenuOpen(false)}
          onLibrary={() => {
            setPhotoMenuOpen(false)
            void sendSupportPhoto({
              source: "library",
              caseId: id,
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
            void sendSupportPhoto({
              source: "camera",
              caseId: id,
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
    </AccountState>
  )
}

function SupportMessageBubble({
  message,
  accessToken,
  colors,
}: {
  message: MobileSupportMessage
  accessToken: string | null
  colors: ReturnType<typeof useReswellColors>
}) {
  const imageAttachment = message.attachment?.kind === "image"
  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  const showCaption = message.body && !(imageAttachment && message.body === "Photo")

  return (
    <View style={[styles.bubble, message.mine ? styles.mine : styles.theirs]}>
      <View
        style={[
          styles.bubbleInner,
          imageAttachment ? styles.mediaBubble : null,
          {
            backgroundColor: message.mine ? colors.primary : colors.image,
            borderColor: colors.border,
          },
        ]}
      >
        {imageAttachment ? (
          <Image
            source={{ uri: supportCaseMessageAttachmentUrl(message.id), headers: authHeaders }}
            style={[styles.messageImage, { backgroundColor: colors.image }]}
            contentFit="cover"
          />
        ) : null}
        {showCaption ? (
          <Text
            style={[
              styles.body,
              imageAttachment ? styles.mediaCaption : null,
              {
                color: message.mine ? colors.primaryForeground : colors.foreground,
                fontFamily: fontFamily.text,
              },
            ]}
          >
            {message.body}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

async function sendSupportPhoto(opts: {
  source: "library" | "camera"
  caseId: string
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
    const attachment = await uploadSupportCaseImageAttachment({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    })
    const caption = opts.caption.trim()
    await sendSupportMediaMessage(opts.accessToken, opts.caseId, {
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

const styles = StyleSheet.create({
  thread: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, flexGrow: 1 },
  bubble: { maxWidth: "85%" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  bubbleInner: { overflow: "hidden", borderRadius: 16 },
  mediaBubble: { borderWidth: StyleSheet.hairlineWidth, maxWidth: 260 },
  body: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, lineHeight: 22 },
  mediaCaption: { paddingTop: 0 },
  messageImage: { width: 240, height: 240 },
  empty: { textAlign: "center", paddingVertical: 24, fontSize: 15 },
  closed: { textAlign: "center", paddingHorizontal: 16, paddingTop: 8, fontSize: 14 },
  attach: { padding: 8, marginLeft: -4 },
})
