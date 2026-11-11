import { SymbolView } from "expo-symbols"
import { useEffect, useRef } from "react"
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  type TextInput as RNTextInput,
} from "react-native"
import { SellField } from "@/components/sell/sell-field"
import type { MobileSellCatalogRow } from "@reswell/api-contract"
import { fontFamily, useReswellColors } from "@/theme"

const LIST_MAX_HEIGHT = 240

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

function animateSuggestLayout() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  })
}

function rowTitle(row: MobileSellCatalogRow): string {
  return row.kind === "model" && row.model_name ? row.model_name : row.title
}

function rowMeta(row: MobileSellCatalogRow): string {
  return row.kind === "model" ? row.brand_name : row.category_label
}

function hasExactCatalogMatch(rows: MobileSellCatalogRow[], value: string): boolean {
  const q = value.trim().toLowerCase()
  if (!q) return false
  return rows.some((row) => rowTitle(row).trim().toLowerCase() === q)
}

export function SellCatalogSuggestField({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
  open,
  onOpen,
  onClose,
  onKeepTyped,
  rows,
  loading = false,
  onPick,
  listLabel,
  /** Show the panel on focus even before the seller has typed (catalog model browse). */
  allowEmptyQuery = false,
}: {
  label: string
  required?: boolean
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  open: boolean
  onOpen: () => void
  /** Hide the list without locking it — re-focus can open it again. */
  onClose: () => void
  /** Hide the list and keep the typed value so it does not pop back while they keep typing. */
  onKeepTyped: () => void
  rows: MobileSellCatalogRow[]
  loading?: boolean
  onPick: (row: MobileSellCatalogRow) => void
  listLabel: string
  allowEmptyQuery?: boolean
}) {
  const colors = useReswellColors()
  const inputRef = useRef<RNTextInput>(null)
  const pickingRef = useRef(false)
  const skipFocusOpenRef = useRef(false)
  const openRef = useRef(open)
  const onCloseRef = useRef(onClose)
  openRef.current = open
  onCloseRef.current = onClose
  const trimmed = value.trim()
  const canShowEmpty = allowEmptyQuery || trimmed.length >= 2
  const showPanel = open && canShowEmpty && (loading || rows.length > 0 || trimmed.length > 0)
  const showToggle = canShowEmpty && (open || rows.length > 0 || loading || trimmed.length > 0)
  const exactMatch = hasExactCatalogMatch(rows, value)

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      if (pickingRef.current || !openRef.current) return
      animateSuggestLayout()
      onCloseRef.current()
    })
    return () => sub.remove()
  }, [])

  function openList() {
    if (skipFocusOpenRef.current || open) return
    animateSuggestLayout()
    onOpen()
  }

  function reopenList() {
    skipFocusOpenRef.current = false
    if (open) return
    animateSuggestLayout()
    onOpen()
  }

  function keepTyped(stayFocused: boolean) {
    if (!open) return
    pickingRef.current = true
    skipFocusOpenRef.current = stayFocused
    animateSuggestLayout()
    onKeepTyped()
    if (stayFocused) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    setTimeout(() => {
      pickingRef.current = false
      skipFocusOpenRef.current = false
    }, 300)
  }

  function pick(row: MobileSellCatalogRow) {
    pickingRef.current = true
    animateSuggestLayout()
    onPick(row)
    setTimeout(() => {
      pickingRef.current = false
    }, 250)
  }

  return (
    <View style={styles.wrap}>
      <SellField
        label={label}
        required={required}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        blurOnSubmit
        inputRef={inputRef}
        onFocus={() => {
          if (allowEmptyQuery && trimmed.length === 0) return
          openList()
        }}
        onBlur={() => {
          setTimeout(() => {
            if (pickingRef.current || !openRef.current) return
            animateSuggestLayout()
            onCloseRef.current()
          }, 180)
        }}
        onSubmitEditing={() => keepTyped(false)}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? "Close suggestions" : "Show suggestions"}
            accessibilityState={{ disabled: !open && !showToggle }}
            disabled={!open && !showToggle}
            hitSlop={8}
            onPress={open ? () => keepTyped(true) : reopenList}
            style={styles.toggle}
          >
            <SymbolView
              name={
                open
                  ? { ios: "xmark", android: "close", web: "close" }
                  : { ios: "chevron.down", android: "expand_more", web: "expand_more" }
              }
              size={16}
              tintColor={colors.muted}
            />
          </Pressable>
        }
      />
      {showPanel ? (
        <View
          style={[
            styles.panel,
            {
              borderColor: colors.foreground,
              backgroundColor: colors.background,
              shadowColor: colors.foreground,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{listLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done, keep what I typed"
              hitSlop={8}
              onPress={() => keepTyped(true)}
              style={styles.done}
            >
              <Text style={[styles.doneLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Done</Text>
            </Pressable>
          </View>
          {loading && rows.length === 0 ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.listingHeart} />
            </View>
          ) : rows.length > 0 ? (
            <ScrollView
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              style={styles.list}
              bounces={false}
            >
              {rows.map((row) => (
                <Pressable
                  key={`${row.kind}-${row.id}`}
                  accessibilityRole="button"
                  onPress={() => pick(row)}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                    {rowTitle(row)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>{rowMeta(row)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                No catalog match
              </Text>
              <Text style={[styles.emptyCopy, { color: colors.muted, fontFamily: fontFamily.text }]}>
                We'll use “{trimmed}”. Tap Done to keep typing.
              </Text>
            </View>
          )}
          {trimmed.length > 0 && !exactMatch ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => keepTyped(true)}
              style={[styles.keep, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.keepTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                Keep “{trimmed}”
              </Text>
              <Text style={[styles.keepMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                Not in our catalog — that's fine
              </Text>
            </Pressable>
          ) : rows.length > 0 && trimmed.length === 0 ? (
            <View style={[styles.keep, { borderTopColor: colors.border }]}>
              <Text style={[styles.keepMeta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                Don't see it? Type your own, then tap Done.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { zIndex: 2, gap: 4 },
  toggle: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: {
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 13, fontWeight: "600" },
  done: { minHeight: 44, minWidth: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  doneLabel: { fontSize: 16, fontWeight: "700" },
  loading: { minHeight: 64, alignItems: "center", justifyContent: "center" },
  list: { maxHeight: LIST_MAX_HEIGHT },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowMeta: { fontSize: 13 },
  empty: { paddingHorizontal: 14, paddingVertical: 14, gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptyCopy: { fontSize: 13, lineHeight: 18 },
  keep: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keepTitle: { fontSize: 15, fontWeight: "600" },
  keepMeta: { fontSize: 13, lineHeight: 18 },
})
