import { StripeProvider, useStripe } from "@stripe/stripe-react-native"
import { Stack, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
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
  const router = useRouter()
  const stripe = useStripe()
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const cart = useAccountResource(fetchCart)
  const [addresses, setAddresses] = useState<MobileCheckoutAddress[]>([])
  const [addressId, setAddressId] = useState<string | null>(null)
  const [fulfillment, setFulfillment] = useState<"shipping" | "pickup">("shipping")
  const [quote, setQuote] = useState<MobileCheckoutQuote | null>(null)
  const [serviceCode, setServiceCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ full_name: "", line1: "", city: "", state: "", postal_code: "" })

  const items = cart.data?.items ?? []
  const listingIds = items.map((item) => item.listing.id)
  const canShip = items.length > 0 && items.every((item) => item.listing.shipping_available)
  const canPickup = items.length > 0 && items.every((item) => item.listing.local_pickup)

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

  const totalLabel = fulfillment === "pickup" ? `$${items.reduce((sum, item) => sum + item.listing.price_usd * item.quantity, 0).toFixed(2)}` : quote?.total_label

  async function pay() {
    if (!token || listingIds.length === 0 || paying) return
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
      ) : (
        <VerticalScroll contentContainerStyle={styles.list}>
          <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Delivery</Text>
          <View style={styles.choices}>
            {canShip ? (
              <Choice label="Ship to me" active={fulfillment === "shipping"} onPress={() => setFulfillment("shipping")} />
            ) : null}
            {canPickup ? (
              <Choice label="Local pickup" active={fulfillment === "pickup"} onPress={() => setFulfillment("pickup")} />
            ) : null}
          </View>
          {fulfillment === "shipping" ? (
            <>
              <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Ship to</Text>
              {addresses.map((address) => (
                <Pressable key={address.id} onPress={() => { setServiceCode(null); setAddressId(address.id) }} style={[styles.address, { borderColor: address.id === addressId ? colors.foreground : colors.border }]}>
                  <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>{address.full_name}</Text>
                  <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{address.label_line}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setAdding((open) => !open)}>
                <Text style={[styles.link, { color: colors.foreground, fontFamily: fontFamily.text }]}>{adding ? "Close address form" : "Add address"}</Text>
              </Pressable>
              {adding ? (
                <View style={styles.form}>
                  {(["full_name", "line1", "city", "state", "postal_code"] as const).map((field) => (
                    <TextInput
                      key={field}
                      value={draft[field]}
                      onChangeText={(value) => setDraft((current) => ({ ...current, [field]: value }))}
                      placeholder={field === "full_name" ? "Full name" : field === "line1" ? "Street" : field === "postal_code" ? "Postal code" : field[0]?.toUpperCase() + field.slice(1)}
                      placeholderTextColor={colors.muted}
                      autoCapitalize={field === "state" ? "characters" : "words"}
                      style={[styles.input, { color: colors.foreground, borderColor: colors.border, fontFamily: fontFamily.text }]}
                    />
                  ))}
                  <Pressable
                    onPress={() => {
                      if (!token) return
                      saveCheckoutAddress(token, draft)
                        .then((page) => {
                          setAddresses(page.addresses)
                          setAddressId(page.addresses[0]?.id ?? null)
                          setAdding(false)
                          setError(null)
                        })
                        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to save that address"))
                    }}
                    style={[styles.save, { backgroundColor: colors.foreground }]}
                  >
                    <Text style={[styles.saveLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Save address</Text>
                  </Pressable>
                </View>
              ) : null}
              {quoting ? <ActivityIndicator color={colors.foreground} /> : null}
              {quote && quote.rates.length > 0 ? (
                <>
                  <Text style={[styles.section, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Shipping</Text>
                  {quote.rates.map((rate) => (
                    <Pressable
                      key={rate.rate_id}
                      onPress={() => setServiceCode(rate.service_code)}
                      style={[styles.address, { borderColor: rate.service_code === serviceCode ? colors.foreground : colors.border }]}
                    >
                      <Text style={[styles.addressName, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                        {rate.label} · {rate.amount_label}
                      </Text>
                      {rate.delivery_days != null ? (
                        <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                          {rate.delivery_days} day{rate.delivery_days === 1 ? "" : "s"}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              You’ll arrange pickup with the seller after payment.
            </Text>
          )}
          {error ? <Text style={[styles.error, { color: colors.destructive, fontFamily: fontFamily.text }]}>{error}</Text> : null}
        </VerticalScroll>
      )}
      <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.total, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{totalLabel ?? "—"}</Text>
        <Pressable
          disabled={paying || (fulfillment === "shipping" && (!quote || quoting))}
          onPress={() => void pay()}
          style={[styles.pay, { backgroundColor: colors.foreground, opacity: paying || (fulfillment === "shipping" && !quote) ? 0.45 : 1 }]}
        >
          <Text style={[styles.saveLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>
            {paying ? "Paying…" : "Pay"}
          </Text>
        </Pressable>
      </View>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, textAlign: "center", marginTop: 48 },
  list: { padding: 16, paddingBottom: 120, gap: 10 },
  section: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  choices: { flexDirection: "row", gap: 8 },
  choice: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  choiceLabel: { fontSize: 14, fontWeight: "700" },
  address: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 2 },
  addressName: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
  form: { gap: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  save: { borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  saveLabel: { fontSize: 16, fontWeight: "700" },
  error: { fontSize: 14 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  total: { fontSize: 24, fontWeight: "700" },
  pay: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
})
