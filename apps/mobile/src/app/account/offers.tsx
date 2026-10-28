import { useMemo, useState } from "react"
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native"
import { AccountState } from "@/components/account-state"
import { OfferListRow } from "@/components/offers/offer-list-row"
import { OfferRoleFilters } from "@/components/offers/offer-role-filters"
import { fetchOffers } from "@/lib/api"
import {
  offerCountLabel,
  offerMatchesQuery,
  offerMatchesRole,
  offerNeedsAction,
  offersFilterEmptyMessage,
  sortOffers,
  type OffersRoleFilter,
} from "@/lib/offer-display"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

export default function OffersScreen() {
  const colors = useReswellColors()
  const { data, error, loading, reload } = useAccountResource(fetchOffers)
  const allOffers = data?.offers ?? []
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<OffersRoleFilter>("all")
  const receivedCount = useMemo(() => allOffers.filter((item) => item.role === "received").length, [allOffers])
  const sentCount = useMemo(() => allOffers.filter((item) => item.role === "sent").length, [allOffers])
  const filtered = useMemo(
    () => sortOffers(allOffers.filter((item) => offerMatchesRole(item, filter))),
    [allOffers, filter],
  )
  const visible = useMemo(
    () => filtered.filter((item) => offerMatchesQuery(item, query)),
    [filtered, query],
  )
  const searching = query.trim().length > 0
  const countLabel = offerCountLabel(searching ? visible.length : filtered.length)
  const showGroups = filter === "all" && !searching

  return (
    <AccountState
      title="Offers"
      loading={loading}
      error={error}
      onRetry={reload}
      empty="When you make or receive an offer, it shows up here."
      isEmpty={allOffers.length === 0}
    >
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Make and respond to offers.
            </Text>
            <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamily.text }]}>{countLabel}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="title or person"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Search offers by title or person"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              clearButtonMode="while-editing"
              style={[
                styles.search,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.sellerProfileBannerDefault,
                  fontFamily: fontFamily.text,
                },
              ]}
            />
            <OfferRoleFilters
              activeFilter={filter}
              receivedCount={receivedCount}
              sentCount={sentCount}
              onChange={setFilter}
            />
          </View>
        }
        ListEmptyComponent={
          searching ? (
            <Text style={[styles.emptySearch, { color: colors.muted, fontFamily: fontFamily.text }]}>
              No offers match that search.
            </Text>
          ) : (
            <Text style={[styles.emptySearch, { color: colors.muted, fontFamily: fontFamily.text }]}>
              {offersFilterEmptyMessage(filter)}
            </Text>
          )
        }
        renderItem={({ item, index }) => {
          const previous = index > 0 ? visible[index - 1] : undefined
          const showNeedsHeading = showGroups && offerNeedsAction(item) && index === 0
          const showEarlierHeading =
            showGroups && !offerNeedsAction(item) && (index === 0 || Boolean(previous && offerNeedsAction(previous)))
          return (
            <View>
              {showNeedsHeading ? (
                <Text style={[styles.group, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  Needs a response
                </Text>
              ) : null}
              {showEarlierHeading ? (
                <Text style={[styles.groupMuted, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  Earlier offers
                </Text>
              ) : null}
              <OfferListRow item={item} onReload={reload} />
            </View>
          )
        }}
      />
    </AccountState>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 16 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  count: { fontSize: 22, fontWeight: "500", lineHeight: 26 },
  search: {
    height: 48,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  emptySearch: { paddingHorizontal: 16, paddingVertical: 48, textAlign: "center", fontSize: 14 },
  group: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 14, fontWeight: "700" },
  groupMuted: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontSize: 14, fontWeight: "700" },
})
