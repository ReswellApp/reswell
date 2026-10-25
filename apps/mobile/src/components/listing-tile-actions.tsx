import { SymbolView } from "expo-symbols"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native"
import { setCartItem, setFavorite } from "@/lib/api"
import { useAuthGate } from "@/lib/auth-gate"
import { useListingMarks } from "@/lib/listing-marks"
import { useReswellColors } from "@/theme"

/** Website listing-tile heart. Stays ink-colored on the white photo pill. */
const HEART = "#04070E"

/** Heart over the photo. Signed-out taps open the sign-in sheet. */
export function ListingFavoriteButton({
  listingId,
  initialFavorited,
  onFavoritedChange,
}: {
  listingId: string
  initialFavorited?: boolean
  onFavoritedChange?: (favorited: boolean) => void
}) {
  const { requestAuth } = useAuthGate()
  const marks = useListingMarks()
  const saved = initialFavorited || marks.favorited.has(listingId)
  const [favorited, setFavorited] = useState(saved)
  const [busy, setBusy] = useState(false)
  const touched = useRef(false)

  useEffect(() => {
    if (touched.current) return
    setFavorited(initialFavorited || marks.favorited.has(listingId))
  }, [initialFavorited, listingId, marks.favorited])

  async function toggle() {
    if (busy) return
    requestAuth((token) => {
      setBusy(true)
      touched.current = true
      const next = !favorited
      void setFavorite(token, listingId, next)
        .then((result) => {
          setFavorited(result.favorited)
          marks.setFavorited(listingId, result.favorited)
          onFavoritedChange?.(result.favorited)
        })
        .catch(() => setFavorited(favorited))
        .finally(() => setBusy(false))
    })
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorited ? "Remove from favorites" : "Save to favorites"}
      onPress={() => void toggle()}
      style={styles.heart}
    >
      {busy ? (
        <ActivityIndicator size="small" color={HEART} />
      ) : (
        <SymbolView
          name={{
            ios: favorited ? "heart.fill" : "heart",
            android: favorited ? "favorite" : "favorite_border",
            web: favorited ? "favorite" : "favorite_border",
          }}
          size={16}
          tintColor={HEART}
        />
      )}
    </Pressable>
  )
}

/** Bag beside the price. Signed-out taps open the sign-in sheet. */
export function ListingCartButton({ listingId }: { listingId: string }) {
  const colors = useReswellColors()
  const { requestAuth } = useAuthGate()
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(timer)
  }, [added])

  async function add() {
    if (busy) return
    requestAuth((token) => {
      setBusy(true)
      void setCartItem(token, listingId, 1)
        .then(() => setAdded(true))
        .catch((cause: unknown) => {
          setAdded(false)
          const message = cause instanceof Error ? cause.message : "Could not add this to your cart"
          Alert.alert("Cart", message)
        })
        .finally(() => setBusy(false))
    })
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add to cart"
      onPress={() => void add()}
      style={[styles.cart, { backgroundColor: colors.background, borderColor: colors.border }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.foreground} />
      ) : (
        <SymbolView
          name={{
            ios: added ? "checkmark" : "bag",
            android: added ? "check" : "shopping_bag",
            web: added ? "check" : "shopping_bag",
          }}
          size={16}
          tintColor={colors.foreground}
        />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(229,229,229,0.9)",
  },
  cart: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
})
