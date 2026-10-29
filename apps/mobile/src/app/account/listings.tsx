import { Image } from "expo-image"
import { SymbolView } from "expo-symbols"
import { useRouter } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileMyListings } from "@reswell/api-contract"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { SCREEN_GUTTER } from "@/components/screen-shell"
import { fetchMyListings, relistListing, setListingVacation } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type StatusTab = "active" | "draft" | "sold" | "vacation"
type SortMode = "recent" | "views" | "price"
type Listing = MobileMyListings["listings"][number]

const TABS: { id: StatusTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "sold", label: "Sold" },
  { id: "vacation", label: "Vacation" },
]

const SORTS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "views", label: "Views" },
  { id: "price", label: "Price" },
]

export default function AccountListingsScreen() {
  const load = useCallback((accessToken: string) => fetchMyListings(accessToken), [])
  const listings = useAccountResource(load)
  return (
    <DashboardPageGate id="listings" title="Listings">
      {() => (
        <ListingsDesk
          data={listings.data}
          loading={listings.loading}
          error={listings.error}
          onReload={listings.reload}
        />
      )}
    </DashboardPageGate>
  )
}

function ListingsDesk({
  data,
  loading,
  error,
  onReload,
}: {
  data: MobileMyListings | null
  loading: boolean
  error: string | null
  onReload: () => void
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [tab, setTab] = useState<StatusTab>("active")
  const [sort, setSort] = useState<SortMode>("recent")
  const [sortOpen, setSortOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const listings = data?.listings ?? []
  const counts = useMemo(() => {
    return {
      active: listings.filter((listing) => matchesTab(listing, "active")).length,
      draft: listings.filter((listing) => matchesTab(listing, "draft")).length,
      sold: listings.filter((listing) => matchesTab(listing, "sold")).length,
      vacation: listings.filter((listing) => matchesTab(listing, "vacation")).length,
    }
  }, [listings])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = listings.filter((listing) => {
      if (!matchesTab(listing, tab)) return false
      if (!needle) return true
      return (
        listing.title.toLowerCase().includes(needle) ||
        (listing.brand?.toLowerCase().includes(needle) ?? false) ||
        listing.status_label.toLowerCase().includes(needle)
      )
    })
    return sortListings(rows, sort)
  }, [listings, query, sort, tab])

  async function run(id: string, action: (token: string) => Promise<{ message: string }>) {
    const token = session?.access_token
    if (!token || busyId) return
    setBusyId(id)
    setNotice(null)
    try {
      const result = await action(token)
      setNotice(result.message)
      onReload()
    } catch (cause: unknown) {
      setNotice(cause instanceof Error ? cause.message : "Unable to update that listing")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={onReload}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            Listings
          </Text>

          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {TABS.map((item) => {
              const active = tab === item.id
              const count = counts[item.id]
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(item.id)}
                  style={[styles.tab, active && { borderBottomColor: colors.listingHeart }]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: active ? colors.listingHeart : colors.muted,
                        fontFamily: fontFamily.text,
                      },
                    ]}
                  >
                    {item.label}
                    {count > 0 ? ` (${count})` : ""}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {data ? (
            <View style={[styles.statsCard, { backgroundColor: colors.secondary }]}>
              <StatPill value={data.total_views} label="Views" />
              <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
              <StatPill value={data.in_carts} label="Carts" />
              <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
              <StatPill value={data.saved} label="Saves" />
            </View>
          ) : null}

          <View style={styles.toolbar}>
            <View
              style={[
                styles.searchWrap,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <SymbolView
                name={{ ios: "magnifyingglass", android: "search", web: "search" }}
                size={16}
                tintColor={colors.muted}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search listings"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Search listings"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={[styles.searchInput, { color: colors.foreground, fontFamily: fontFamily.text }]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSortOpen((open) => !open)}
              style={[styles.sortChip, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Text style={[styles.sortLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {SORTS.find((item) => item.id === sort)?.label ?? "Recent"}
              </Text>
              <SymbolView
                name={{
                  ios: sortOpen ? "chevron.up" : "chevron.down",
                  android: sortOpen ? "expand_less" : "expand_more",
                  web: "expand_more",
                }}
                size={14}
                tintColor={colors.muted}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New listing"
              onPress={() => router.push("/sell/new")}
              style={[styles.filterButton, { backgroundColor: colors.listingHeart }]}
            >
              <SymbolView
                name={{ ios: "plus", android: "add", web: "add" }}
                size={18}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>

          {sortOpen ? (
            <View style={[styles.sortMenu, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {SORTS.map((item) => {
                const active = sort === item.id
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSort(item.id)
                      setSortOpen(false)
                    }}
                    style={styles.sortOption}
                  >
                    <Text
                      style={[
                        styles.sortOptionLabel,
                        {
                          color: active ? colors.listingHeart : colors.foreground,
                          fontFamily: fontFamily.text,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {notice ? (
            <Text style={[styles.notice, { color: colors.foreground, fontFamily: fontFamily.text }]}>{notice}</Text>
          ) : null}
          {loading && !data ? (
            <Text style={[styles.notice, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading listings…</Text>
          ) : null}
          {error && !data ? (
            <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        data ? (
          <Text style={[styles.empty, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {query.trim()
              ? "No listings match that search."
              : tab === "draft"
                ? "No drafts yet."
                : tab === "sold"
                  ? "No sold listings yet."
                  : tab === "vacation"
                    ? "No listings on vacation."
                    : "No active listings yet."}
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <ListingRow
          listing={item}
          busy={busyId === item.id}
          onOpen={() => {
            if (item.slug) router.push({ pathname: "/listing/[id]", params: { id: item.slug } })
          }}
          onEdit={() => router.push({ pathname: "/listing/edit/[id]", params: { id: item.id } })}
          onVacation={() =>
            void run(item.id, (token) =>
              setListingVacation(token, { listing_id: item.id, enabled: !item.on_vacation }),
            )
          }
          onRelist={() => void run(item.id, (token) => relistListing(token, item.id))}
        />
      )}
    />
  )
}

function ListingRow({
  listing,
  busy,
  onOpen,
  onEdit,
  onVacation,
  onRelist,
}: {
  listing: Listing
  busy: boolean
  onOpen: () => void
  onEdit: () => void
  onVacation: () => void
  onRelist: () => void
}) {
  const colors = useReswellColors()
  const subtitle = listing.brand ? `by ${listing.brand}` : listing.status_label
  const detail = [listing.condition_label, listing.on_vacation ? "Vacation" : null]
    .filter((part): part is string => Boolean(part))
    .join(" · ")

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.rowMain}>
        {listing.image_url ? (
          <Image
            source={{ uri: listing.image_url }}
            style={[styles.thumb, { backgroundColor: colors.image }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.image }]} />
        )}
        <View style={styles.rowCopy}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
            {listing.title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {subtitle}
          </Text>
          <Text style={[styles.price, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
            {listing.price_label}
          </Text>
          {detail ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{detail}</Text>
          ) : null}
          {listing.created_label ? (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Listed {listing.created_label}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.rowAside}>
        {listing.can_edit ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit listing" onPress={onEdit} hitSlop={8}>
            <SymbolView
              name={{ ios: "square.and.pencil", android: "edit", web: "edit" }}
              size={20}
              tintColor={colors.listingHeart}
            />
          </Pressable>
        ) : (
          <View style={styles.editSpacer} />
        )}
        <View style={styles.engagement}>
          <Engagement icon="eye" label={plural(listing.views, "view")} />
          <Engagement icon="heart" label={plural(listing.favorite_count, "save")} />
        </View>
        {listing.can_vacation || listing.can_relist ? (
          <View style={styles.rowActions}>
            {listing.can_vacation ? (
              <Pressable disabled={busy} onPress={onVacation}>
                <Text style={[styles.rowAction, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
                  {busy ? "…" : listing.on_vacation ? "End vacation" : "Vacation"}
                </Text>
              </Pressable>
            ) : null}
            {listing.can_relist ? (
              <Pressable disabled={busy} onPress={onRelist}>
                <Text style={[styles.rowAction, { color: colors.listingHeart, fontFamily: fontFamily.text }]}>
                  {busy ? "…" : "Relist"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function StatPill({ value, label }: { value: number; label: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
}

function Engagement({ icon, label }: { icon: "eye" | "heart"; label: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.engagementItem}>
      <SymbolView
        name={
          icon === "eye"
            ? { ios: "eye", android: "visibility", web: "visibility" }
            : { ios: "heart", android: "favorite", web: "favorite" }
        }
        size={12}
        tintColor={colors.muted}
      />
      <Text style={[styles.engagementLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
    </View>
  )
}

function matchesTab(listing: Listing, tab: StatusTab): boolean {
  if (tab === "vacation") return listing.on_vacation && listing.status !== "sold" && listing.status !== "draft"
  if (tab === "active") return listing.status === "active" && !listing.on_vacation
  if (tab === "draft") return listing.status === "draft"
  return listing.status === "sold"
}

function sortListings(listings: Listing[], sort: SortMode): Listing[] {
  const rows = [...listings]
  if (sort === "views") return rows.sort((a, b) => b.views - a.views)
  if (sort === "price") {
    return rows.sort((a, b) => priceValue(b.price_label) - priceValue(a.price_label))
  }
  return rows
}

function priceValue(label: string): number {
  const value = Number(label.replace(/[^0-9.]/g, ""))
  return Number.isFinite(value) ? value : 0
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

const styles = StyleSheet.create({
  list: { paddingBottom: 28 },
  header: { paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, gap: 14, paddingBottom: 8 },
  pageTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.6 },
  tabs: {
    flexDirection: "row",
    gap: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 15, fontWeight: "700" },
  statsCard: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  statPill: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 12, fontWeight: "600" },
  statsDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 4 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchWrap: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  sortChip: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sortLabel: { fontSize: 14, fontWeight: "600" },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sortMenu: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
  },
  sortOption: { paddingHorizontal: 14, paddingVertical: 12 },
  sortOptionLabel: { fontSize: 15, fontWeight: "600" },
  notice: { fontSize: 14 },
  empty: { paddingHorizontal: SCREEN_GUTTER, paddingVertical: 48, textAlign: "center", fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: SCREEN_GUTTER + 72 + 12 },
  row: {
    paddingHorizontal: SCREEN_GUTTER,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: "row", gap: 12, minWidth: 0 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  price: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  meta: { fontSize: 12, lineHeight: 16 },
  rowAside: { alignItems: "flex-end", gap: 8, paddingTop: 2 },
  editSpacer: { height: 20 },
  engagement: { alignItems: "flex-end", gap: 4 },
  engagementItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  engagementLabel: { fontSize: 11, lineHeight: 14 },
  rowActions: { alignItems: "flex-end", gap: 4, marginTop: 2 },
  rowAction: { fontSize: 12, fontWeight: "700" },
})
