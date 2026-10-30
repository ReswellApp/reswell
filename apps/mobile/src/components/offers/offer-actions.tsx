import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { MobileOffer } from "@reswell/api-contract"
import { actOnOffer } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { isOfferPastExpiry, offerNeedsAction } from "@/lib/offer-display"
import { fontFamily, useReswellColors } from "@/theme"

export function OfferActions({
  offer,
  onDone,
  compact = false,
}: {
  offer: MobileOffer
  onDone: () => void
  compact?: boolean
}) {
  const colors = useReswellColors()
  const { session } = useAuth()
  const [counter, setCounter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const token = session?.access_token
  const expired = isOfferPastExpiry(offer)
  const sellerBid = !expired && offer.side === "seller" && offer.status === "PENDING" && !offer.seller_initiated
  const buyerPending = !expired && offer.side === "buyer" && offer.status === "PENDING" && !offer.seller_initiated
  const buyerCounter = offerNeedsAction(offer) && offer.side === "buyer"
  const sellerOfferOpen =
    !expired && offer.side === "seller" && offer.seller_initiated && offer.status === "COUNTERED"
  if (!sellerBid && !buyerPending && !buyerCounter && !sellerOfferOpen) return null

  async function run(action: "accept" | "decline" | "counter" | "withdraw", amount?: number) {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      await actOnOffer(token, offer.id, {
        action,
        counter_amount: amount,
      })
      onDone()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update this offer")
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.wrap}>
      {sellerBid || buyerCounter ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept offer"
            disabled={busy}
            onPress={() => void run("accept")}
            style={[styles.primary, { backgroundColor: colors.listingHeart, opacity: busy ? 0.55 : 1 }]}
          >
            <Text style={[styles.primaryLabel, { color: "#FFFFFF", fontFamily: fontFamily.text }]}>Accept</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline offer"
            disabled={busy}
            onPress={() => void run("decline")}
            style={[styles.secondary, styles.stretch, { borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}
          >
            <Text style={[styles.secondaryLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
      {buyerPending || sellerOfferOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sellerOfferOpen ? "Revoke offer" : "Withdraw offer"}
          disabled={busy}
          onPress={() => void run("withdraw")}
          style={[styles.secondary, { alignSelf: "flex-start", borderColor: colors.border, opacity: busy ? 0.55 : 1 }]}
        >
          <Text style={[styles.secondaryLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {sellerOfferOpen ? "Revoke offer" : "Withdraw"}
          </Text>
        </Pressable>
      ) : null}
      {sellerBid && !compact ? (
        <View style={styles.row}>
          <TextInput
            value={counter}
            onChangeText={setCounter}
            keyboardType="decimal-pad"
            placeholder="Counter amount"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Counter amount"
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                borderColor: colors.sellerProfileBannerDefault,
                fontFamily: fontFamily.text,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send counter offer"
            disabled={busy}
            onPress={() => {
              const amount = Number(counter)
              if (!Number.isFinite(amount) || amount <= 0) {
                setError("Enter a counter amount.")
                return
              }
              void run("counter", amount)
            }}
            style={[styles.counter, { backgroundColor: colors.foreground, opacity: busy ? 0.55 : 1 }]}
          >
            <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
              Counter
            </Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  primary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  stretch: { flex: 1 },
  counter: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryLabel: { fontSize: 15, fontWeight: "700" },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryLabel: { fontSize: 15, fontWeight: "700" },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 14 },
})
