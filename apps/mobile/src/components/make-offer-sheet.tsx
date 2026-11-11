import { Image } from "expo-image"
import { StripeProvider, useStripe } from "@stripe/stripe-react-native"
import { SymbolView } from "expo-symbols"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { MobileCheckoutAddress, MobileListingDetail } from "@reswell/api-contract"
import { VerticalScroll } from "@/components/horizontal-rail"
import {
  createListingOffer,
  fetchCheckoutAddresses,
  fetchCheckoutConfig,
  quoteCheckout,
  saveCheckoutAddress,
  startListingOfferPayment,
} from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { fontFamily, useReswellColors } from "@/theme"

type OfferStep = "offer" | "delivery" | "pay"
type Fulfillment = "pickup" | "shipping"

const EMPTY_ADDRESS = { full_name: "", line1: "", line2: "", city: "", state: "", postal_code: "" }
const QUICK_OFF = [5, 10, 15] as const

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundMoney(n)
}

function money(n: number): string {
  return `$${n.toFixed(2)}`
}

function itemNoun(section: string): string {
  if (section === "surfboards") return "board"
  if (section === "fins") return "fin"
  if (section === "wetsuits") return "wetsuit"
  return "item"
}

function shippingHint(mode: MobileListingDetail["shipping_cost_mode"], flat: number): string {
  if (mode === "free") return "This listing includes free shipping."
  if (mode === "flat") {
    return flat > 0
      ? `Listing flat shipping (${money(flat)}) is charged when you send the offer — not negotiated.`
      : "This listing includes free shipping."
  }
  return "Reswell calculates carrier shipping from your address when you send the offer — not negotiated."
}

export function MakeOfferSheet({
  visible,
  listing,
  onClose,
  onCreated,
}: {
  visible: boolean
  listing: MobileListingDetail
  onClose: () => void
  onCreated: (offerId: string) => void
}) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !token) return
    let cancelled = false
    fetchCheckoutConfig(token)
      .then((config) => {
        if (!cancelled) {
          setPublishableKey(config.publishable_key)
          setConfigError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setConfigError(cause instanceof Error ? cause.message : "Card payments are not configured")
      })
    return () => {
      cancelled = true
    }
  }, [token, visible])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {!visible ? null : configError ? (
        <OfferFrame listing={listing} onClose={onClose} stepLabel={null}>
          <Text style={styles.notice}>{configError}</Text>
        </OfferFrame>
      ) : !publishableKey ? (
        <OfferFrame listing={listing} onClose={onClose} stepLabel={null}>
          <ActivityIndicator />
        </OfferFrame>
      ) : (
        <StripeProvider publishableKey={publishableKey}>
          <MakeOfferForm listing={listing} onClose={onClose} onCreated={onCreated} />
        </StripeProvider>
      )}
    </Modal>
  )
}

function OfferFrame({
  listing,
  onClose,
  stepLabel,
  children,
  footer,
}: {
  listing: MobileListingDetail
  onClose: () => void
  stepLabel: string | null
  children: ReactNode
  footer?: ReactNode
}) {
  const colors = useReswellColors()
  const insets = useSafeAreaInsets()
  const image = listing.image_urls[0] ?? listing.image_url

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fontFamily.headline }]}>Make an offer</Text>
          {stepLabel ? (
            <Text style={[styles.step, { color: colors.muted, fontFamily: fontFamily.text }]}>Step {stepLabel}</Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
          <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} tintColor={colors.foreground} />
        </Pressable>
      </View>
      <View style={[styles.listingCard, { borderColor: colors.border, backgroundColor: colors.image }]}>
        {image ? (
          <Image source={{ uri: image }} style={[styles.thumb, { backgroundColor: colors.image }]} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.border }]} />
        )}
        <View style={styles.listingCopy}>
          <Text numberOfLines={2} style={[styles.listingTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>
            {listing.title}
          </Text>
          <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>List {listing.price_label}</Text>
        </View>
      </View>
      <VerticalScroll contentContainerStyle={styles.body}>
        {children}
      </VerticalScroll>
      {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  )
}

function MakeOfferForm({
  listing,
  onClose,
  onCreated,
}: {
  listing: MobileListingDetail
  onClose: () => void
  onCreated: (offerId: string) => void
}) {
  const colors = useReswellColors()
  const stripe = useStripe()
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const canShip = listing.shipping_available
  const canPick = listing.local_pickup
  const [step, setStep] = useState<OfferStep>("offer")
  const [fulfillment, setFulfillment] = useState<Fulfillment>(canShip && !canPick ? "shipping" : "pickup")
  const [amountInput, setAmountInput] = useState("")
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [addresses, setAddresses] = useState<MobileCheckoutAddress[]>([])
  const [addressId, setAddressId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_ADDRESS)
  const [quoteToken, setQuoteToken] = useState<string | null>(null)
  const [shippingUsd, setShippingUsd] = useState<number | null>(null)
  const [quoting, setQuoting] = useState(false)

  const offerAmount = useMemo(() => parseAmount(amountInput), [amountInput])
  const amountBelow = offerAmount !== null && offerAmount < listing.min_offer_usd
  const amountValid =
    offerAmount !== null && offerAmount >= listing.min_offer_usd && offerAmount <= listing.price_usd
  const methodLocked = (canPick && !canShip) || (!canPick && canShip)
  const needsLiveQuote = fulfillment === "shipping" && listing.shipping_cost_mode === "reswell"
  const knownShipping =
    fulfillment === "pickup"
      ? 0
      : listing.shipping_cost_mode === "free"
        ? 0
        : listing.shipping_cost_mode === "flat"
          ? listing.shipping_flat_rate
          : shippingUsd
  const totalPreview = offerAmount != null && knownShipping != null ? roundMoney(offerAmount + knownShipping) : null
  const selectedAddress = addresses.find((row) => row.id === addressId) ?? null
  const deliveryReady =
    fulfillment === "pickup" ||
    (Boolean(addressId) && !quoting && !needsLiveQuote) ||
    (Boolean(addressId) && Boolean(quoteToken) && !quoting)
  const stepLabel =
    step === "offer"
      ? "1 of 3 · Your offer"
      : step === "delivery"
        ? fulfillment === "pickup"
          ? "2 of 3 · Pickup"
          : "2 of 3 · Shipping"
        : "3 of 3 · Payment"
  const shippingCostLabel =
    quoting ? "Calculating…" : knownShipping != null ? (knownShipping === 0 ? "Free" : money(knownShipping)) : "—"
  const deliverySummary =
    fulfillment === "pickup"
      ? "Local pickup"
      : selectedAddress
        ? selectedAddress.label_line
        : "Shipping"

  const loadAddresses = useCallback(() => {
    if (!token) return
    fetchCheckoutAddresses(token)
      .then((page) => {
        setAddresses(page.addresses)
        setAddressId((current) => current ?? page.addresses.find((row) => row.is_default)?.id ?? page.addresses[0]?.id ?? null)
        setAdding(page.addresses.length === 0)
      })
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Unable to load addresses"))
  }, [token])

  useEffect(() => {
    if (step === "delivery") loadAddresses()
  }, [loadAddresses, step])

  useEffect(() => {
    if (fulfillment !== "shipping") {
      setQuoteToken(null)
      setShippingUsd(0)
      setQuoting(false)
      return
    }
    if (!needsLiveQuote) {
      setQuoteToken(null)
      setShippingUsd(listing.shipping_cost_mode === "free" ? 0 : listing.shipping_flat_rate)
      setQuoting(false)
      return
    }
    if (!token || !addressId) {
      setQuoteToken(null)
      setShippingUsd(null)
      return
    }
    let cancelled = false
    setQuoting(true)
    quoteCheckout(token, { listing_ids: [listing.id], address_id: addressId })
      .then((quote) => {
        if (cancelled) return
        setShippingUsd(quote.shipping_usd)
        setQuoteToken(quote.quote_token)
        setNotice(null)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setQuoteToken(null)
          setShippingUsd(null)
          setNotice(cause instanceof Error ? cause.message : "Could not calculate shipping for this address.")
        }
      })
      .finally(() => {
        if (!cancelled) setQuoting(false)
      })
    return () => {
      cancelled = true
    }
  }, [addressId, fulfillment, listing.id, listing.shipping_cost_mode, listing.shipping_flat_rate, needsLiveQuote, token])

  function goToDelivery() {
    if (!amountValid || offerAmount === null) {
      setNotice(`Enter an offer between ${money(listing.min_offer_usd)} and ${listing.price_label}.`)
      return
    }
    setNotice(null)
    setStep("delivery")
  }

  function goToPay() {
    if (!deliveryReady) {
      setNotice(fulfillment === "shipping" ? "Add your delivery details to continue." : "Confirm pickup to continue.")
      return
    }
    setNotice(null)
    setStep("pay")
  }

  async function authorize(accessToken: string) {
    if (busy || offerAmount === null || !stripe) return
    setBusy(true)
    setNotice(null)
    try {
      const payment = await startListingOfferPayment(accessToken, listing.id, {
        amount: offerAmount,
        fulfillment,
        ...(fulfillment === "shipping" && addressId ? { address_id: addressId } : {}),
        ...(quoteToken ? { quote_token: quoteToken } : {}),
      })
      const sheet = await stripe.initPaymentSheet({
        merchantDisplayName: "Reswell",
        paymentIntentClientSecret: payment.client_secret,
        returnURL: "reswell://offers",
      })
      if (sheet.error) throw new Error(sheet.error.message)
      const presented = await stripe.presentPaymentSheet()
      if (presented.error) {
        if (presented.error.code !== "Canceled") throw new Error(presented.error.message)
        return
      }
      const created = await createListingOffer(accessToken, listing.id, {
        amount: offerAmount,
        fulfillment,
        payment_intent_id: payment.payment_intent_id,
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(fulfillment === "shipping" && addressId ? { address_id: addressId } : {}),
        ...(quoteToken ? { quote_token: quoteToken } : {}),
      })
      onCreated(created.offer_id)
    } catch (cause: unknown) {
      setNotice(cause instanceof Error ? cause.message : "Could not send your offer")
    } finally {
      setBusy(false)
    }
  }

  const footerLabel =
    step === "offer"
      ? "Continue"
      : step === "delivery"
        ? "Continue to payment"
        : busy
          ? "Opening…"
          : totalPreview != null
            ? `Reserve ${money(totalPreview)}`
            : "Reserve payment"

  return (
    <OfferFrame
      listing={listing}
      onClose={onClose}
      stepLabel={stepLabel}
      footer={
        <View style={styles.footer}>
          {notice ? <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>{notice}</Text> : null}
          <View style={styles.totals}>
            <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
              Offer {offerAmount != null ? money(offerAmount) : "—"}
              {fulfillment === "shipping" ? ` · Shipping ${shippingCostLabel}` : " · Pickup"}
            </Text>
            <Text style={[styles.total, { color: colors.foreground, fontFamily: fontFamily.headline }]}>
              {step === "pay" ? "Reserved" : "Total"} {totalPreview != null ? money(totalPreview) : "—"}
            </Text>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => {
              if (step === "offer") goToDelivery()
              else if (step === "delivery") goToPay()
              else if (token) void authorize(token)
            }}
            style={[styles.primary, { backgroundColor: colors.foreground, opacity: busy ? 0.45 : 1 }]}
          >
            <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>{footerLabel}</Text>
          </Pressable>
          {step !== "offer" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              onPress={() => setStep(step === "pay" ? "delivery" : "offer")}
              style={styles.backButton}
            >
              <Text style={[styles.backLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Back</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      {step === "offer" ? (
        <>
          <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamily.text }]}>Delivery method</Text>
          {methodLocked ? (
            <View style={[styles.locked, { borderColor: colors.border }]}>
              <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: fontFamily.text }]}>
                {canShip && !canPick ? "Ship to me" : "Local pickup"}
              </Text>
            </View>
          ) : (
            <View style={styles.choices}>
              {canShip ? (
                <Choice label="Ship to me" active={fulfillment === "shipping"} onPress={() => setFulfillment("shipping")} />
              ) : null}
              {canPick ? (
                <Choice label="Local pickup" active={fulfillment === "pickup"} onPress={() => setFulfillment("pickup")} />
              ) : null}
            </View>
          )}
          <Text style={[styles.hint, { color: colors.muted, fontFamily: fontFamily.text }]}>
            {fulfillment === "shipping" && canShip
              ? shippingHint(listing.shipping_cost_mode, listing.shipping_flat_rate)
              : "You’ll arrange pickup with the seller if they accept — no shipping charged."}
          </Text>

          <View style={styles.amountHead}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Your offer</Text>
            {listing.hide_min_offer_until_violated ? null : (
              <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>
                Min {money(listing.min_offer_usd)} ({listing.min_offer_pct}% of {money(listing.price_usd)})
              </Text>
            )}
          </View>
          <View style={[styles.amountWrap, { borderColor: !amountValid && amountInput.trim() ? colors.destructive : colors.border }]}>
            <Text style={[styles.dollar, { color: colors.muted, fontFamily: fontFamily.text }]}>$</Text>
            <TextInput
              value={amountInput}
              onChangeText={(value) => {
                setAmountInput(value)
                if (notice) setNotice(null)
              }}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: colors.foreground, fontFamily: fontFamily.text }]}
            />
          </View>
          {listing.hide_min_offer_until_violated && amountBelow ? (
            <Text style={[styles.notice, { color: colors.destructive, fontFamily: fontFamily.text }]}>
              The lowest the seller will accept for this item is {money(listing.min_offer_usd)}.
            </Text>
          ) : null}
          <View style={styles.quick}>
            {QUICK_OFF.map((pct) => (
              <Pressable
                key={pct}
                onPress={() => {
                  const next = Math.max(listing.min_offer_usd, Math.min(listing.price_usd, roundMoney(listing.price_usd * (1 - pct / 100))))
                  setAmountInput(next.toFixed(2))
                }}
                style={[styles.chip, { backgroundColor: colors.image }]}
              >
                <Text style={[styles.chipLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>{pct}% off</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            maxLength={200}
            multiline
            placeholder={`Why you want this ${itemNoun(listing.section)}…`}
            placeholderTextColor={colors.muted}
            style={[styles.message, { color: colors.foreground, backgroundColor: colors.image, fontFamily: fontFamily.text }]}
          />
        </>
      ) : null}

      {step === "delivery" ? (
        fulfillment === "pickup" ? (
          <>
            <StepHeading
              title="Confirm pickup"
              subtitle="No shipping is added. You’ll meet the seller after they accept this offer."
            />
            <ExplainRow
              ios="mappin.and.ellipse"
              android="location_on"
              title={listing.pickup_label?.trim() || "Local pickup"}
              detail="You’ll message the seller after they accept to pick a time and meeting spot."
            />
            <ExplainRow
              ios="bubble.left"
              android="chat_bubble"
              title="Arrange after they accept"
              detail="Once they say yes, you’ll pick a time and meeting spot in Messages."
            />
            <ExplainRow
              ios="dollarsign.circle"
              android="attach_money"
              title="No shipping charged"
              detail={
                offerAmount != null
                  ? `We’ll reserve ${money(offerAmount)} for this ${itemNoun(listing.section)} only.`
                  : "Pickup doesn’t add anything to the amount we reserve."
              }
            />
          </>
        ) : (
          <>
            <StepHeading
              title="Where should we send it?"
              subtitle="Shipping is added to the amount we reserve — it isn’t part of the offer price."
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: fontFamily.text }]}>Ship to</Text>
            {addresses.map((address) => (
              <Pressable
                key={address.id}
                onPress={() => setAddressId(address.id)}
                style={[styles.addressCard, { borderColor: address.id === addressId ? colors.foreground : colors.border }]}
              >
                <View style={styles.addressCopy}>
                  <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: fontFamily.text }]}>{address.full_name}</Text>
                  <Text style={[styles.meta, { color: colors.muted, fontFamily: fontFamily.text }]}>{address.label_line}</Text>
                </View>
                {address.id === addressId ? (
                  <SymbolView
                    name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }}
                    size={20}
                    tintColor={colors.foreground}
                  />
                ) : null}
              </Pressable>
            ))}
            <Pressable onPress={() => setAdding((open) => !open)} accessibilityRole="button">
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
                <Pressable
                  onPress={() => {
                    if (!token) return
                    saveCheckoutAddress(token, draft)
                      .then((page) => {
                        setAddresses(page.addresses)
                        const match = page.addresses.find(
                          (address) => address.line1 === draft.line1.trim() && address.postal_code === draft.postal_code.trim(),
                        )
                        setAddressId(match?.id ?? page.addresses[0]?.id ?? null)
                        setAdding(false)
                        setDraft(EMPTY_ADDRESS)
                      })
                      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Unable to save that address"))
                  }}
                  style={[styles.primary, { backgroundColor: colors.foreground }]}
                >
                  <Text style={[styles.primaryLabel, { color: colors.primaryForeground, fontFamily: fontFamily.text }]}>Save address</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={[styles.recap, { backgroundColor: colors.image }]}>
              <RecapLine label="Shipping" value={shippingCostLabel} />
              <RecapLine label="Reserved total" value={totalPreview != null ? money(totalPreview) : "—"} strong />
            </View>
          </>
        )
      ) : null}

      {step === "pay" ? (
        <>
          <StepHeading
            title="Reserve this offer"
            subtitle="We hold the total on your card now. You’re only charged if the seller accepts."
          />
          <View style={[styles.recap, { backgroundColor: colors.image }]}>
            <RecapLine label="Your offer" value={offerAmount != null ? money(offerAmount) : "—"} />
            <RecapLine label="Delivery" value={deliverySummary} />
            {fulfillment === "shipping" ? <RecapLine label="Shipping" value={shippingCostLabel} /> : null}
            <RecapLine label="We’ll reserve" value={totalPreview != null ? money(totalPreview) : "—"} strong />
          </View>
          <ExplainRow
            ios="creditcard"
            android="credit_card"
            title="Hold, not a charge"
            detail={
              totalPreview != null
                ? `${money(totalPreview)} is reserved until they accept, decline, or the offer expires.`
                : "Your card is authorized now and only captured if the seller accepts."
            }
          />
          <ExplainRow
            ios="clock"
            android="schedule"
            title="Seller has 48 hours"
            detail="They can accept, counter, or decline. You’ll hear in Messages either way."
          />
          <ExplainRow
            ios="checkmark.circle"
            android="check_circle"
            title="If they accept"
            detail="We charge the reserved amount and the sale is complete — no extra checkout."
          />
        </>
      ) : null}
    </OfferFrame>
  )
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useReswellColors()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, { borderColor: active ? colors.foreground : colors.border, backgroundColor: active ? colors.foreground : colors.background }]}
    >
      <Text style={[styles.choiceLabel, { color: active ? colors.primaryForeground : colors.foreground, fontFamily: fontFamily.text }]}>{label}</Text>
    </Pressable>
  )
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const colors = useReswellColors()
  return (
    <View style={styles.stepHead}>
      <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: fontFamily.headline }]}>{title}</Text>
      <Text style={[styles.stepSubtitle, { color: colors.muted, fontFamily: fontFamily.text }]}>{subtitle}</Text>
    </View>
  )
}

function ExplainRow({
  ios,
  android,
  title,
  detail,
}: {
  ios: string
  android: string
  title: string
  detail: string
}) {
  const colors = useReswellColors()
  return (
    <View style={styles.explainRow}>
      <View style={[styles.explainIcon, { backgroundColor: colors.image }]}>
        <SymbolView name={{ ios, android, web: android }} size={18} tintColor={colors.shipping} />
      </View>
      <View style={styles.explainCopy}>
        <Text style={[styles.explainTitle, { color: colors.foreground, fontFamily: fontFamily.text }]}>{title}</Text>
        <Text style={[styles.explainDetail, { color: colors.muted, fontFamily: fontFamily.text }]}>{detail}</Text>
      </View>
    </View>
  )
}

function RecapLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useReswellColors()
  return (
    <View style={styles.recapLine}>
      <Text style={[styles.recapLabel, { color: colors.muted, fontFamily: fontFamily.text }]}>{label}</Text>
      <Text
        style={[
          strong ? styles.recapStrong : styles.recapValue,
          { color: colors.foreground, fontFamily: strong ? fontFamily.headline : fontFamily.text },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerCopy: { gap: 2 },
  title: { fontSize: 22, fontWeight: "700" },
  step: { fontSize: 12 },
  listingCard: { marginHorizontal: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, flexDirection: "row", gap: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  listingCopy: { flex: 1, justifyContent: "center", gap: 2 },
  listingTitle: { fontSize: 15, fontWeight: "600" },
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  label: { fontSize: 12, fontWeight: "600" },
  fieldLabel: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  locked: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  bodyText: { fontSize: 15 },
  hint: { fontSize: 13, lineHeight: 18 },
  choices: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  choiceLabel: { fontSize: 15, fontWeight: "600" },
  amountHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  amountWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  dollar: { fontSize: 18, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 18 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  message: { minHeight: 72, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlignVertical: "top" },
  addressCard: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  addressCopy: { flex: 1, gap: 2 },
  link: { fontSize: 15, fontWeight: "600", textDecorationLine: "underline" },
  form: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  totals: { gap: 2 },
  total: { fontSize: 18, fontWeight: "700" },
  meta: { fontSize: 13 },
  notice: { fontSize: 14 },
  primary: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontSize: 16, fontWeight: "700" },
  backButton: { alignItems: "center", paddingVertical: 4 },
  backLabel: { fontSize: 16, fontWeight: "600" },
  stepHead: { gap: 6, marginBottom: 4 },
  stepTitle: { fontSize: 20, fontWeight: "700" },
  stepSubtitle: { fontSize: 15, lineHeight: 21 },
  explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  explainIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  explainCopy: { flex: 1, gap: 2, paddingTop: 2 },
  explainTitle: { fontSize: 15, fontWeight: "700" },
  explainDetail: { fontSize: 14, lineHeight: 20 },
  recap: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  recapLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  recapLabel: { fontSize: 14, flexShrink: 0 },
  recapValue: { fontSize: 14, flex: 1, textAlign: "right" },
  recapStrong: { fontSize: 15, fontWeight: "700", flex: 1, textAlign: "right" },
})
