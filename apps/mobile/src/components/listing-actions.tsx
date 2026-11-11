import { useRouter } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileListingDetail } from "@reswell/api-contract"
import { MakeOfferSheet } from "@/components/make-offer-sheet"
import { useAuthGate } from "@/lib/auth-gate"
import { fontFamily, useReswellColors } from "@/theme"

function canPurchase(listing: MobileListingDetail): boolean {
  if (listing.owner) return false
  if (listing.status !== "active" && listing.status !== "pending_sale") return false
  return listing.shipping_available || listing.local_pickup
}

function canMakeOffer(listing: MobileListingDetail): boolean {
  return canPurchase(listing) && listing.buyer_offers_enabled && listing.price_usd > 0
}

export function ListingActions({
  listing,
  onChange,
}: {
  listing: MobileListingDetail
  onChange: (next: MobileListingDetail) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { requestAuth } = useAuthGate()
  const [offerOpen, setOfferOpen] = useState(false)
  const buyEnabled = canPurchase(listing)
  const offerEnabled = canMakeOffer(listing)
  const openOfferId = listing.open_offer_id ?? null

  if (!buyEnabled && !offerEnabled) return null

  function buyNow() {
    requestAuth(() => {
      router.push({ pathname: "/account/checkout", params: { listing: listing.id } })
    })
  }

  function openOffer() {
    if (openOfferId) {
      requestAuth(() => {
        router.push({ pathname: "/account/offers/[id]", params: { id: openOfferId } })
      })
      return
    }
    requestAuth(() => setOfferOpen(true))
  }

  return (
    <View style={[styles.bar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
        {buyEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buy now"
            onPress={buyNow}
            style={[styles.buy, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buyLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Buy now</Text>
          </Pressable>
        ) : null}
        {offerEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={openOfferId ? "View offer" : "Make an offer"}
            onPress={openOffer}
            style={[styles.offer, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <Text style={[styles.offerLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {openOfferId ? "View offer" : "Make offer"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <MakeOfferSheet
        visible={offerOpen}
        listing={listing}
        onClose={() => setOfferOpen(false)}
        onCreated={(offerId) => {
          setOfferOpen(false)
          onChange({ ...listing, open_offer_id: offerId })
          router.push({ pathname: "/account/offers/[id]", params: { id: offerId } })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  buy: { flex: 1, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  buyLabel: { fontSize: 16, fontWeight: "700" },
  offer: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  offerLabel: { fontSize: 16, fontWeight: "700" },
})
