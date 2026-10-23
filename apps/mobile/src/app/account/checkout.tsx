import { Image } from "expo-image"
import { StripeProvider, useStripe } from "@stripe/stripe-react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileCheckoutAddress, MobileCheckoutQuote } from "@reswell/api-contract"
import { VerticalScroll } from "@/components/horizontal-rail"
import {
  fetchCart,
  fetchCheckoutAddresses,
  fetchCheckoutConfig,
  finalizeCheckout,
  quoteCheckout,
  saveCheckoutAddress,
  startCheckoutPayment,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useAccountResource } from "@/lib/use-account-resource"
import { fontFamily, useReswellColors } from "@/theme"

const EMPTY_ADDRESS = { full_name: "", line1: "", line2: "", city: "", state: "", postal_code: "" }

export default function CheckoutScreen() {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchCheckoutConfig(token)
      .then((config) => {
        if (!cancelled) setPublishableKey(config.publishable_key)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setConfigError(cause instanceof Error ? cause.message : "Card payments are not configured")
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Checkout" }} />
      {configError ? (
        <Text style={styles.centered}>{configError}</Text>
      ) : !publishableKey ? (
        <ActivityIndicator style={styles.centered} />
      ) : (
        <StripeProvider publishableKey={publishableKey}>
          <CheckoutForm />
        </StripeProvider>
      )}
    </View>
  )
}

function CheckoutForm() {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const stripe = useStripe()
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const params = useLocalSearchParams<{ listing?: string | string[] }>()
  const listingParam = Array.isArray(params.listing) ? params.listing[0] : params.listing
  const cart = useAccountResource(fetchCart)
  const [addresses, setAddresses] = useState<MobileCheckoutAddress[]>([])
  const [addressId, setAddressId] = useState<string | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
  const [fulfillment, setFulfillment] = useState<"shipping" | "pickup">("shipping")
  const [quote, setQuote] = useState<MobileCheckoutQuote | null>(null)
  const [serviceCode, setServiceCode] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [paying, setPaying] = useState(false)

  const cartItems = cart.data?.items ?? []
  const items = listingParam ? cartItems.filter((item) => item.listing.id === listingParam) : cartItems
  const listingIds = items.map((item) => item.listing.id)
  const itemUsd = items.reduce((sum, item) => sum + item.listing.price_usd * item.quantity, 0)
  const canShip = items.length > 0 && items.every((item) => item.listing.shipping_available)
  const canPickup = items.length > 0 && items.every((item) => item.listing.local_pickup)
  const selected = addresses.find((address) => address.id === addressId) ?? null
  const selectedRate = quote?.rates.find((rate) => rate.service_code === serviceCode) ?? quote?.rates[0] ?? null
  const ready = fulfillment === "pickup" || (Boolean(addressId) && Boolean(quote) && !quoting)

  const loadAddresses = useCallback(() => {
    if (!token) return
    fetchCheckoutAddresses(token)
      .then((page) => {
        setAddresses(page.addresses)
        setAddressId((current) => current ?? page.addresses.find((address) => address.is_default)?.id ?? page.addresses[0]?.id ?? null)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load addresses"))
  }, [token])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  useEffect(() => {
    if (canShip && !canPickup) setFulfillment("shipping")
    if (canPickup && !canShip) setFulfillment("pickup")
  }, [canShip, canPickup])

  useEffect(() => {
    if (!token || fulfillment !== "shipping" || !addressId || listingIds.length === 0) {
      setQuote(null)
      return
    }
    let cancelled = false
    setQuoting(true)
    quoteCheckout(token, {
      listing_ids: listingIds,
      address_id: addressId,
      ...(serviceCode ? { service_code: serviceCode } : {}),
    })
      .then((next) => {
        if (cancelled) return
        setQuote(next)
        setError(null)
        if (!serviceCode && next.rates[0]?.service_code) setServiceCode(next.rates[0].service_code)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setQuote(null)
          setError(cause instanceof Error ? cause.message : "Unable to quote shipping")
        }
      })
      .finally(() => {
        if (!cancelled) setQuoting(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, fulfillment, addressId, listingIds.join(","), serviceCode])

  const places = [
    ...new Set(
      items
        .map((item) => listedPlace(item.listing.city, item.listing.state))
        .filter((place): place is string => Boolean(place)),
    ),
  ]
  const placeLine = places.length === 1 ? places[0] : null
  const totalLabel = fulfillment === "pickup" ? money(itemUsd) : quote?.total_label ?? (quoting ? "…" : money(itemUsd))
  const includes =
    fulfillment === "pickup"
      ? "Local pickup. No shipping charge."
      : quote
        ? `Includes ${selectedRate?.label ?? "shipping"} ${quote.shipping_label}`
        : "Shipping is added after you choose an address."

  async function pay() {
    if (!token || listingIds.length === 0 || paying || !ready) return
    setPaying(true)
    setError(null)
    try {
      const payment = await startCheckoutPayment(token, {
        listing_ids: listingIds,
        fulfillment,
        ...(fulfillment === "shipping" && addressId ? { address_id: addressId } : {}),
        ...(fulfillment === "shipping" && quote?.quote_token ? { quote_token: quote.quote_token } : {}),
      })
      const sheet = await stripe.initPaymentSheet({
        merchantDisplayName: "Reswell",
        paymentIntentClientSecret: payment.client_secret,
        returnURL: "reswell://checkout",
      })
      if (sheet.error) throw new Error(sheet.error.message)
      const presented = await stripe.presentPaymentSheet()
      if (presented.error) {
        if (presented.error.code !== "Canceled") throw new Error(presented.error.message)
        return
      }
      const paymentIntentId = payment.client_secret.split("_secret_")[0]
      await finalizeCheckout(token, paymentIntentId)
      router.replace("/account/purchases")
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not complete payment")
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {cart.loading && items.length === 0 ? (
        <ActivityIndicator style={styles.centered} color={colors.foreground} />
      ) : items.length === 0 ? (
        <Text style={[styles.missing, { color: colors.muted, fontFamily: fontFamily.text }]}>
          That item is no longer in your cart.
        </Text>
      ) : (
        <VerticalScroll contentContainerStyle={styles.list}>
          {items.map((item) => {
            const place = listedPlace(item.listing.city, item.listing.state)
            return (
            <Pressable
              key={item.listing.id}
              onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.listing.slug || item.listing.id } })}
              style={[styles.product, { borderColor: colors.border }]}
            >
              {item.listing.image_url ? (
                <Image source={{ uri: item.listing.image_url }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.image }]} />
              )}
              <View style={styles.productCopy}>
                <Text numberOfLines={2} style={[styles.productTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {item.listing.title}
                </Text>
                <Text style={[styles.productPrice, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {item.quantity > 1 ? `${item.quantity} × ` : ""}
                  {item.listing.price_label}
                </Text>
                {place ? (
                  <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                    {fulfillment === "pickup" ? `Pickup in ${place}` : `Ships from ${place}`}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            )
          })}

          {canShip && canPickup ? (
            <View style={styles.choices}>
              <Choice label="Ship to me" active={fulfillment === "shipping"} onPress={() => setFulfillment("shipping")} />
              <Choice label="Local pickup" active={fulfillment === "pickup"} onPress={() => setFulfillment("pickup")} />
            </View>
          ) : null}

          <Pressable onPress={() => setSummaryOpen((open) => !open)} style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Order summary</Text>
              <Text style={[styles.totalLine, { color: colors.foreground, fontFamily: fontFamily.text }]}>Total {totalLabel}</Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{includes}</Text>
            </View>
            <SymbolView
              name={{ ios: summaryOpen ? "chevron.down" : "chevron.right", android: summaryOpen ? "expand_more" : "chevron_right", web: "chevron_right" }}
              size={16}
              tintColor={colors.muted}
            />
          </Pressable>
          {summaryOpen ? (
            <View style={[styles.breakdown, { backgroundColor: colors.image }]}>
              {items.map((item) => (
                <SummaryLine
                  key={item.listing.id}
                  label={item.quantity > 1 ? `${item.listing.title} × ${item.quantity}` : item.listing.title}
                  value={money(item.listing.price_usd * item.quantity)}
                />
              ))}
              <SummaryLine
                label={fulfillment === "pickup" ? "Local pickup" : selectedRate?.label ?? "Shipping"}
                value={fulfillment === "pickup" ? "$0.00" : quote?.shipping_label ?? (quoting ? "…" : "—")}
              />
              {quote && quote.rates.length > 1 && fulfillment === "shipping"
                ? quote.rates.map((rate) => (
                    <Pressable key={rate.rate_id} onPress={() => setServiceCode(rate.service_code)}>
                      <Text style={[styles.rate, { color: rate.service_code === selectedRate?.service_code ? colors.foreground : colors.muted, fontFamily: fontFamily.text }]}>
                        {rate.service_code === selectedRate?.service_code ? "● " : "○ "}
                        {rate.label} · {rate.amount_label}
                        {rate.delivery_days != null ? ` · ${rate.delivery_days}d` : ""}
                      </Text>
                    </Pressable>
                  ))
                : null}
              <SummaryLine label="Total" value={totalLabel} strong />
            </View>
          ) : null}

          {fulfillment === "shipping" ? (
            <Pressable onPress={() => setAddressOpen(true)} style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Ship to</Text>
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  {placeLine ? `Ships from ${placeLine}` : "Ships from the seller’s listing location"}
                </Text>
                {selected ? (
                  <>
                    <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{selected.full_name}</Text>
                    <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{formatAddress(selected)}</Text>
                  </>
                ) : (
                  <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>Add a shipping address</Text>
                )}
              </View>
              <SymbolView name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }} size={16} tintColor={colors.muted} />
            </Pressable>
          ) : (
            <View style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>Pickup</Text>
                <Text style={[styles.meta, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                  {placeLine ? `Pickup in ${placeLine}` : places.length > 1 ? places.map((place) => `Pickup in ${place}`).join(" · ") : "Pickup location comes from the listing"}
                </Text>
                <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                  You’ll arrange a time with the seller after payment.
                </Text>
              </View>
            </View>
          )}

          {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
        </VerticalScroll>
      )}
      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerCopy}>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>Total</Text>
          <Text style={[styles.footerTotal, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{totalLabel}</Text>
        </View>
        <Pressable
          disabled={!ready || paying}
          onPress={() => void pay()}
          style={[styles.pay, { backgroundColor: colors.foreground, opacity: !ready || paying ? 0.45 : 1 }]}
        >
          <Text style={[styles.payLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
            {paying ? "Opening…" : "Proceed to pay"}
          </Text>
        </Pressable>
      </View>
      <AddressSheet
        open={addressOpen}
        addresses={addresses}
        selectedId={addressId}
        onClose={() => setAddressOpen(false)}
        onSelect={(id) => {
          setServiceCode(null)
          setAddressId(id)
          setAddressOpen(false)
        }}
        onSaved={(page, match) => {
          setAddresses(page.addresses)
          setServiceCode(null)
          setAddressId(match?.id ?? page.addresses[0]?.id ?? null)
          setAddressOpen(false)
        }}
      />
    </View>
  )
}

function AddressSheet({
  open,
  addresses,
  selectedId,
  onClose,
  onSelect,
  onSaved,
}: {
  open: boolean
  addresses: MobileCheckoutAddress[]
  selectedId: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onSaved: (page: { addresses: MobileCheckoutAddress[] }, match: MobileCheckoutAddress | undefined) => void
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const { session } = useAuth()
  const [adding, setAdding] = useState(addresses.length === 0)
  const [draft, setDraft] = useState(EMPTY_ADDRESS)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setAdding(addresses.length === 0)
  }, [open, addresses.length])

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} accessibilityLabel="Close addresses">
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Shipping address</Text>
          <View style={styles.sheetSpacer} />
        </View>
        <VerticalScroll contentContainerStyle={styles.sheetList}>
          {addresses.map((address) => (
            <Pressable
              key={address.id}
              onPress={() => onSelect(address.id)}
              style={[styles.addressCard, { borderColor: address.id === selectedId ? colors.foreground : colors.border }]}
            >
              <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{address.full_name}</Text>
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{formatAddress(address)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setAdding((value) => !value)}>
            <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>
              {adding ? "Hide new address" : "Add address"}
            </Text>
          </Pressable>
          {adding ? (
            <View style={styles.form}>
              {(
                [
                  ["full_name", "Full name"],
                  ["line1", "Street"],
                  ["line2", "Apt, suite (optional)"],
                  ["city", "City"],
                  ["state", "State"],
                  ["postal_code", "Postal code"],
                ] as const
              ).map(([field, placeholder]) => (
                <TextInput
                  key={field}
                  value={draft[field]}
                  onChangeText={(value) => setDraft((current) => ({ ...current, [field]: value }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  autoCapitalize={field === "state" ? "characters" : "words"}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
                />
              ))}
              {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
              <Pressable
                disabled={saving}
                onPress={() => {
                  const accessToken = session?.access_token
                  if (!accessToken || saving) return
                  setSaving(true)
                  setError(null)
                  saveCheckoutAddress(accessToken, {
                    full_name: draft.full_name,
                    line1: draft.line1,
                    line2: draft.line2,
                    city: draft.city,
                    state: draft.state,
                    postal_code: draft.postal_code,
                  })
                    .then((page) => {
                      const match = page.addresses.find(
                        (address) => address.line1 === draft.line1.trim() && address.postal_code === draft.postal_code.trim(),
                      )
                      onSaved(page, match)
                    })
                    .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to save that address"))
                    .finally(() => setSaving(false))
                }}
                style={[styles.save, { backgroundColor: colors.foreground, opacity: saving ? 0.45 : 1 }]}
              >
                <Text style={[styles.payLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
                  {saving ? "Saving…" : "Save address"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </VerticalScroll>
      </View>
    </Modal>
  )
}

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useReswellColors()
  return (
    <View style={styles.summaryLine}>
      <Text numberOfLines={2} style={[styles.summaryLabel, { color: colors.foreground, fontFamily: fontFamily.text, fontWeight: strong ? "700" : "500" }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: colors.foreground, fontFamily: fontFamily.text, fontWeight: strong ? "700" : "600" }]}>{value}</Text>
    </View>
  )
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: active ? colors.foreground : colors.image }]}>
      <Text style={[styles.choiceLabel, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

function listedPlace(city: string | null, state: string | null): string | null {
  const placeCity = city?.trim() ?? ""
  const placeState = state?.trim() ?? ""
  if (placeCity && placeState) return `${placeCity}, ${placeState}`
  return placeCity || placeState || null
}

function formatAddress(address: MobileCheckoutAddress): string {
  const street = [address.line1, address.line2].filter(Boolean).join(", ")
  const city = [address.city, address.state, address.postal_code].filter(Boolean).join(" ")
  return [street, city, address.country].filter(Boolean).join(", ")
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, marginTop: 48 },
  missing: { marginTop: 48, paddingHorizontal: 24, textAlign: "center", fontSize: 16 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 12 },
  product: { flexDirection: "row", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  productCopy: { flex: 1, justifyContent: "center", gap: 4 },
  productTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  productPrice: { fontSize: 15, fontWeight: "700" },
  choices: { flexDirection: "row", gap: 8 },
  choice: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  choiceLabel: { fontSize: 14, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  totalLine: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  meta: { fontSize: 13, lineHeight: 18 },
  breakdown: { borderRadius: 14, padding: 12, gap: 8, marginTop: -4 },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { flex: 1, fontSize: 14 },
  summaryValue: { fontSize: 14 },
  rate: { fontSize: 13, lineHeight: 18 },
  addressName: { fontSize: 15, fontWeight: "600" },
  error: { fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  footerCopy: { gap: 2 },
  footerTotal: { fontSize: 22, fontWeight: "700" },
  pay: { flex: 1, borderRadius: 14, alignItems: "center", paddingVertical: 14 },
  save: { borderRadius: 14, alignItems: "center", paddingVertical: 14 },
  payLabel: { fontSize: 16, fontWeight: "700" },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  sheetSpacer: { width: 18 },
  sheetList: { padding: 16, gap: 10, paddingBottom: 40 },
  addressCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 2 },
  link: { fontSize: 15, fontWeight: "700", textDecorationLine: "underline", marginTop: 4 },
  form: { gap: 8, marginTop: 4 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
})
