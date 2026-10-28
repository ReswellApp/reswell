import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { AccountState } from "@/components/account-state"
import { fetchSupportCases, openSupportCase } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import type { MobileSupportCase } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

export default function AccountSupportScreen() {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const load = useCallback((accessToken: string) => fetchSupportCases(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(load)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const cases = data?.cases ?? []
  const openCases = useMemo(
    () => cases.filter((item) => !item.closed).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
    [cases],
  )
  const pastCases = useMemo(() => cases.filter((item) => item.closed), [cases])
  const hasOpenCase = openCases.length > 0

  const subjectTrim = subject.trim()
  const bodyTrim = body.trim()
  const fieldsFilled = subjectTrim.length > 0 && bodyTrim.length > 0
  const canSubmit = subjectTrim.length >= 3 && bodyTrim.length >= 10

  const submit = () => {
    const token = session?.access_token
    if (!token || sending || !canSubmit) return
    setSending(true)
    setFormError(null)
    void openSupportCase(token, { subject: subjectTrim, body: bodyTrim })
      .then((result) => {
        setSubject("")
        setBody("")
        reload()
        router.push({ pathname: "/account/support/[id]", params: { id: result.id } })
      })
      .catch((cause: unknown) => setFormError(cause instanceof Error ? cause.message : "Unable to start a help thread"))
      .finally(() => setSending(false))
  }

  return (
    <AccountState
      title="Reswell help"
      searchHeader={false}
      loading={loading}
      error={error}
      onRetry={reload}
      empty="No help threads yet."
      isEmpty={!data}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.foreground} />}
      >
        {hasOpenCase ? (
          <OpenSupportThreads
            cases={openCases}
            onOpenCase={(id) => router.push({ pathname: "/account/support/[id]", params: { id } })}
          />
        ) : (
          <NewCaseForm
            subject={subject}
            body={body}
            onSubjectChange={setSubject}
            onBodyChange={setBody}
            formError={formError}
            sending={sending}
            fieldsFilled={fieldsFilled}
            canSubmit={canSubmit}
            onSubmit={submit}
          />
        )}

        {pastCases.length > 0 ? (
          <PastCasesCollapsible
            cases={pastCases}
            onOpenCase={(id) => router.push({ pathname: "/account/support/[id]", params: { id } })}
          />
        ) : null}
      </ScrollView>
    </AccountState>
  )
}

function openThreadPreview(item: MobileSupportCase): { label: string | null; body: string; highlight: boolean } {
  if (item.team_reply_preview) {
    return {
      label: item.unread_count > 0 ? "New reply" : "From our team",
      body: item.team_reply_preview,
      highlight: item.unread_count > 0,
    }
  }
  return {
    label: null,
    body: "We've received your message. We'll reply here soon.",
    highlight: false,
  }
}

function OpenSupportThreads({ cases, onOpenCase }: { cases: MobileSupportCase[]; onOpenCase: (id: string) => void }) {
  const colors = useReswellColors()

  return (
    <View style={styles.openBlock}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Open help threads</Text>
      <Text style={[styles.sectionHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        {cases.length === 1
          ? "Continue your conversation with our team. You can start a new thread after this one is resolved."
          : `You have ${cases.length} open help threads. Pick one to continue — start a new thread after one is resolved.`}
      </Text>
      {cases.map((item) => {
        const preview = openThreadPreview(item)
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onOpenCase(item.id)}
            style={({ pressed }) => [
              styles.openThreadCard,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderLeftColor: colors.listingHeart,
              },
              pressed ? { opacity: 0.88 } : null,
            ]}
          >
            <View style={[styles.openThreadAvatar, { backgroundColor: colors.listingHeart }]}>
              <Text style={[styles.openThreadAvatarLabel, { fontFamily: fontFamily.text }]}>R</Text>
            </View>
            <View style={styles.openThreadCopy}>
              <View style={styles.openThreadTitleRow}>
                <Text numberOfLines={1} style={[styles.openThreadTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  Reswell help
                </Text>
                <View style={[styles.statusPill, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.statusPillLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{item.status_label}</Text>
                </View>
              </View>
              {preview.label ? (
                <Text style={[styles.openThreadLabel, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>{preview.label}</Text>
              ) : null}
              <Text
                numberOfLines={2}
                style={[
                  styles.openThreadPreview,
                  {
                    color: preview.highlight ? colors.foreground : colors.muted,
                    fontFamily: fontFamily.text,
                    fontWeight: preview.highlight ? "600" : "400",
                  },
                ]}
              >
                {preview.body}
              </Text>
            </View>
            <View style={styles.openThreadTrailing}>
              {item.unread_count > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: colors.listingHeart }]}>
                  <Text style={[styles.unreadBadgeLabel, { fontFamily: fontFamily.text }]}>
                    {item.unread_count > 9 ? "9+" : item.unread_count}
                  </Text>
                </View>
              ) : null}
              <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={14} tintColor={colors.muted} />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

function NewCaseForm({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  formError,
  sending,
  fieldsFilled,
  canSubmit,
  onSubmit,
}: {
  subject: string
  body: string
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  formError: string | null
  sending: boolean
  fieldsFilled: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  const colors = useReswellColors()

  return (
    <View style={styles.formBlock}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>New help thread</Text>
      <Text style={[styles.sectionHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
        Tell us what you need help with. We typically reply within one business day.
      </Text>
      <TextInput
        value={subject}
        onChangeText={onSubjectChange}
        placeholder="Subject"
        placeholderTextColor={colors.muted}
        autoCapitalize="sentences"
        style={[
          styles.input,
          { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, fontFamily: fontFamily.text },
        ]}
      />
      <TextInput
        value={body}
        onChangeText={onBodyChange}
        placeholder="How can we help?"
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        style={[
          styles.input,
          styles.message,
          { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, fontFamily: fontFamily.text },
        ]}
      />
      {formError ? <Text style={[styles.formError, { color: colors.destructive, fontFamily: fontFamily.text }]}>{formError}</Text> : null}
      <Pressable
        disabled={sending || !canSubmit}
        onPress={onSubmit}
        style={[
          styles.send,
          {
            backgroundColor: fieldsFilled ? colors.listingHeart : colors.secondary,
            opacity: sending ? 0.7 : fieldsFilled && !canSubmit ? 0.85 : 1,
          },
        ]}
      >
        {sending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.sendLabel,
              {
                color: fieldsFilled ? "#FFFFFF" : colors.muted,
                fontFamily: fontFamily.text,
              },
            ]}
          >
                Get help
          </Text>
        )}
      </Pressable>
      {fieldsFilled && !canSubmit ? (
        <Text style={[styles.validationHint, { color: colors.muted, fontFamily: fontFamily.text }]}>
          Add a bit more detail so we can help (subject at least 3 characters, message at least 10).
        </Text>
      ) : null}
    </View>
  )
}

function PastCasesCollapsible({
  cases,
  onOpenCase,
}: {
  cases: MobileSupportCase[]
  onOpenCase: (id: string) => void
}) {
  const colors = useReswellColors()
  const [open, setOpen] = useState(false)
  const unreadTotal = cases.reduce((sum, item) => sum + item.unread_count, 0)

  return (
    <View style={[styles.casesCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={styles.casesHeader}
      >
        <View style={styles.casesHeaderCopy}>
          <Text style={[styles.casesTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Past help threads</Text>
          <Text style={[styles.casesSubtitle, { color: colors.muted, fontFamily: fontFamily.text }]} numberOfLines={1}>
            {open ? "Tap a thread to view the conversation" : `${cases.length} ${cases.length === 1 ? "thread" : "threads"}`}
          </Text>
        </View>
        <View style={styles.casesHeaderMeta}>
          {unreadTotal > 0 && !open ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.listingHeart }]}>
              <Text style={[styles.unreadBadgeLabel, { fontFamily: fontFamily.text }]}>{unreadTotal > 9 ? "9+" : unreadTotal}</Text>
            </View>
          ) : null}
          <SymbolView
            name={{ ios: open ? "chevron.up" : "chevron.down", android: open ? "expand_less" : "expand_more", web: "expand_more" }}
            size={18}
            tintColor={colors.muted}
            weight="semibold"
          />
        </View>
      </Pressable>
      {open ? (
        <>
          <View style={[styles.casesDivider, { backgroundColor: colors.border }]} />
          {cases.map((item, index) => (
            <View key={item.id}>
              <SupportCaseRow item={item} onPress={() => onOpenCase(item.id)} />
              {index < cases.length - 1 ? <View style={[styles.rowDivider, { backgroundColor: colors.border }]} /> : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  )
}

function SupportCaseRow({ item, onPress }: { item: MobileSupportCase; onPress: () => void }) {
  const colors = useReswellColors()
  const snippet = item.team_reply_preview ?? item.preview
  const detail = [item.status_label, item.order_ref, snippet].filter(Boolean).join(" · ")

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.caseRow, pressed ? { opacity: 0.65 } : null]}>
      <View style={styles.caseCopy}>
        <Text numberOfLines={1} style={[styles.caseTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
          Reswell help
        </Text>
        {detail ? (
          <Text numberOfLines={2} style={[styles.caseDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.caseTrailing}>
        {item.unread_count > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.unreadBadgeLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              {item.unread_count > 9 ? "9+" : item.unread_count}
            </Text>
          </View>
        ) : null}
        <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={14} tintColor={colors.muted} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32, gap: 20 },
  openBlock: { gap: 12 },
  openThreadCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  openThreadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  openThreadAvatarLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  openThreadCopy: { flex: 1, gap: 4, minWidth: 0 },
  openThreadTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  openThreadTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillLabel: { fontSize: 11, fontWeight: "600" },
  openThreadLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.15 },
  openThreadPreview: { fontSize: 14, lineHeight: 20 },
  openThreadTrailing: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  formBlock: { gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sectionHint: { fontSize: 15, lineHeight: 21 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  message: { minHeight: 120 },
  formError: { fontSize: 14, lineHeight: 20 },
  validationHint: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  send: {
    borderRadius: 999,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  sendLabel: { fontSize: 16, fontWeight: "700" },
  casesCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
  },
  casesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  casesHeaderCopy: { flex: 1, gap: 4 },
  casesTitle: { fontSize: 17, fontWeight: "700" },
  casesSubtitle: { fontSize: 14 },
  casesHeaderMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  casesDivider: { height: StyleSheet.hairlineWidth },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  caseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  caseCopy: { flex: 1, gap: 4, minWidth: 0 },
  caseTitle: { fontSize: 16, fontWeight: "600" },
  caseDetail: { fontSize: 14, lineHeight: 19 },
  caseTrailing: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeLabel: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
})
