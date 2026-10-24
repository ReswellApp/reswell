import { Image } from "expo-image"
import { useRouter, type Href } from "expo-router"
import { useCallback, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { MobileMyListings } from "@reswell/api-contract"
import { DashboardPageGate } from "@/components/dashboard-page-gate"
import { fetchMyListings, relistListing, setListingVacation } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

type ViewMode = "basic" | "advanced"
type StatusFilter = "all" | "active" | "draft" | "vacation" | "sold"
type Listing = MobileMyListings["listings"][number]

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "advanced", label: "Advanced" },
]
const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Drafts" },
  { id: "vacation", label: "Vacation" },
  { id: "sold", label: "Sold" },
]

export default function AccountListingsScreen() {
  const load = useCallback((accessToken: string) => fetchMyListings(accessToken), [])
  const listings = useAccountResource(load)
  return (
    <DashboardPageGate id="listings" title="My Listings">
      {(dashboard) => (
        <ListingsDesk
          data={listings.data}
          loading={listings.loading}
          error={listings.error}
          onReload={listings.reload}
          sellerSlug={dashboard.seller_slug}
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
  sellerSlug,
}: {
  data: MobileMyListings | null
  loading: boolean
  error: string | null
  onReload: () => void
  sellerSlug: string | null
}) {
  const colors = useReswellColors()
  const router = useRouter()
  const { session } = useAuth()
  const [view, setView] = useState<ViewMode>("basic")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const listings = data?.listings ?? []
  const visible = listings.filter((listing) => matches(listing, filter))
  const vacationTargets = listings.filter((listing) => listing.can_vacation)
  const shopOnVacation = vacationTargets.length > 0 && vacationTargets.every((listing) => listing.on_vacation)

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
    <ScrollView contentContainerStyle={styles.page}>
      <View style={[styles.switch, { backgroundColor: colors.image }]}>
        {VIEWS.map((item) => {
          const active = view === item.id
          return (
            <Pressable key={item.id} onPress={() => setView(item.id)} style={[styles.switchItem, active && { backgroundColor: colors.background }]}>
              <Text style={[styles.switchLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push("/sell/new")} style={[styles.primary, { backgroundColor: colors.primary }]}>
          <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>New listing</Text>
        </Pressable>
        {vacationTargets.length > 0 ? (
          <Pressable
            onPress={() => void run("shop", (token) => setListingVacation(token, { enabled: !shopOnVacation }))}
            style={[styles.secondary, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {shopOnVacation ? "End shop vacation" : "Shop vacation"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {view === "advanced" && data ? (
        <>
          <View style={styles.stats}>
            <Stat label="Listings" value={String(data.total_listings)} />
            <Stat label="Views" value={String(data.total_views)} />
            <Stat label="In carts" value={String(data.in_carts)} />
            <Stat label="Saved" value={String(data.saved)} />
          </View>
          <View style={styles.tools}>
            <Tool label="Shop profile" href="/account/profile" />
            <Tool label="Offers" href="/account/offers" />
            <Tool label="Earnings" href="/account/earnings" />
            {sellerSlug ? <Tool label="View shop" href={{ pathname: "/profile/[slug]", params: { slug: sellerSlug } }} /> : null}
          </View>
        </>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.id
          return (
            <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, { backgroundColor: active ? colors.foreground : colors.image }]}>
              <Text style={[styles.filterLabel, { color: active ? colors.background : colors.foreground, fontFamily: fontFamily.text }]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {notice ? <Text style={[styles.notice, { color: colors.foreground, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
      {loading && !data ? <Text style={[styles.notice, { color: colors.muted, fontFamily: fontFamily.text }]}>Loading listings…</Text> : null}
      {error && !data ? <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
      {data && visible.length === 0 ? (
        <Text style={[styles.notice, { color: colors.muted, fontFamily: fontFamily.text }]}>No listings in this view.</Text>
      ) : null}
      {visible.map((listing) => (
        <View key={listing.id} style={[styles.card, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => listing.slug && router.push({ pathname: "/listing/[id]", params: { id: listing.slug } })}
            style={styles.identity}
          >
            {listing.image_url ? (
              <Image source={{ uri: listing.image_url }} style={[styles.image, { backgroundColor: colors.image }]} contentFit="cover" />
            ) : (
              <View style={[styles.image, { backgroundColor: colors.image }]} />
            )}
            <View style={styles.copy}>
              <Text style={[styles.status, { color: colors.muted, fontFamily: fontFamily.text }]}>{listing.status_label}</Text>
              <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{listing.title}</Text>
              <Text style={[styles.price, { color: colors.foreground, fontFamily: fontFamily.text }]}>{listing.price_label}</Text>
              {view === "advanced" ? (
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {listing.views} views · {listing.cart_count} in carts · {listing.favorite_count} saved
                </Text>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.rowButtons}>
            {listing.can_vacation ? (
              <RowButton
                label={busyId === listing.id ? "Saving…" : listing.on_vacation ? "End vacation" : "Vacation"}
                onPress={() => void run(listing.id, (token) => setListingVacation(token, { listing_id: listing.id, enabled: !listing.on_vacation }))}
              />
            ) : null}
            {listing.can_relist ? (
              <RowButton label={busyId === listing.id ? "Saving…" : "Relist"} onPress={() => void run(listing.id, (token) => relistListing(token, listing.id))} />
            ) : null}
            {listing.slug ? (
              <RowButton label="View" onPress={() => router.push({ pathname: "/listing/[id]", params: { id: listing.slug ?? listing.id } })} />
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function matches(listing: Listing, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "vacation") return listing.on_vacation && listing.status !== "sold" && listing.status !== "draft"
  if (filter === "active") return listing.status === "active" && !listing.on_vacation
  return listing.status === filter
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useReswellColors()
  return (
    <View style={[styles.stat, { borderColor: colors.border }]}>
      <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{value}</Text>
    </View>
  )
}

function Tool({ label, href }: { label: string; href: Href }) {
  const colors = useReswellColors()
  const router = useRouter()
  return (
    <Pressable onPress={() => router.push(href)} style={[styles.tool, { borderColor: colors.border }]}>
      <Text style={[styles.secondaryLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

function RowButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={[styles.rowButton, { backgroundColor: colors.image }]}>
      <Text style={[styles.rowButtonLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 120, gap: 14 },
  switch: { flexDirection: "row", borderRadius: 999, padding: 4 },
  switchItem: { flex: 1, borderRadius: 999, alignItems: "center", paddingVertical: 8 },
  switchLabel: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  primary: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  primaryLabel: { fontSize: 14, fontWeight: "700" },
  secondary: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryLabel: { fontSize: 14, fontWeight: "600" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { width: "48%", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4 },
  statValue: { fontSize: 22, fontWeight: "700" },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tool: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filters: { gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterLabel: { fontSize: 13, fontWeight: "700" },
  notice: { fontSize: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 12 },
  identity: { flexDirection: "row", gap: 12 },
  image: { width: 84, height: 112, borderRadius: 12 },
  copy: { flex: 1, gap: 2 },
  status: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  title: { fontSize: 16, fontWeight: "700" },
  price: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  rowButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  rowButtonLabel: { fontSize: 13, fontWeight: "700" },
})
