import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import {
  getStripeConnectPrefillData,
  type StripePrefillAddressRow,
} from "@/lib/db/connectPrefill"
import {
  getStripeConnectAccountByUserId,
  insertStripeConnectAccount,
  updateStripeConnectAccountByStripeId,
} from "@/lib/db/stripeConnect"
import { getStripe } from "@/lib/stripe-server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { toUsStateCode } from "@/lib/utils/us-state-code"

/** Satisfies Stripe’s business-profile checks for marketplace sellers without a personal website. */
const MARKETPLACE_PRODUCT_DESCRIPTION =
  "Selling surfboards and related gear to buyers on Reswell, a US peer-to-peer marketplace. " +
  "Customers discover listings and purchase through Reswell; payouts are for completed sales on the platform."

/** Fields we prefill on create/update — must match `AccountCreateParams` so `accounts.create` stays type-safe. */
type StripeConnectAccountPrefillFields = Pick<
  Stripe.AccountCreateParams,
  "email" | "business_type" | "business_profile" | "individual"
>

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Settled USD on the platform account — required for `transfers.create` to connected accounts. */
async function getPlatformAvailableUsdCents(stripe: Stripe): Promise<number> {
  const balance = await stripe.balance.retrieve()
  const usd = balance.available.find((b) => b.currency === "usd")
  return usd?.amount ?? 0
}

function userFacingMessageForStripeTransferError(e: unknown): string {
  if (e instanceof Stripe.errors.StripeError) {
    const code = e.code
    if (code === "balance_insufficient") {
      return (
        "Card sales are still settling through Stripe, so this amount can’t be sent to your bank yet. " +
        "Try again in a few business days, or contact support if your sales have already settled."
      )
    }
    if (code === "amount_too_small") {
      return "The amount is too small for Stripe to transfer. Try a slightly higher amount or contact support."
    }
  }
  return "Stripe could not send funds to your connected account. Check your payout setup or try again."
}

function pickDefaultBank(
  account: Stripe.Account,
): { externalId: string; last4: string | null; bankName: string | null } | null {
  const list = account.external_accounts?.data ?? []
  for (const ex of list) {
    if (ex.object === "bank_account") {
      const b = ex as Stripe.BankAccount
      if (b.default_for_currency) {
        return {
          externalId: b.id,
          last4: b.last4 ?? null,
          bankName: b.bank_name ?? null,
        }
      }
    }
  }
  for (const ex of list) {
    if (ex.object === "bank_account") {
      const b = ex as Stripe.BankAccount
      return {
        externalId: b.id,
        last4: b.last4 ?? null,
        bankName: b.bank_name ?? null,
      }
    }
  }
  return null
}

export async function syncStripeConnectAccountRow(
  supabase: SupabaseClient,
  stripeAccountId: string,
): Promise<Stripe.Account> {
  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(stripeAccountId)
  const bank = pickDefaultBank(account)
  await updateStripeConnectAccountByStripeId(supabase, stripeAccountId, {
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    default_external_account_id: bank?.externalId ?? null,
    bank_last4: bank?.last4 ?? null,
    bank_name: bank?.bankName ?? null,
  })
  return account
}

/** Bank DELETE via Connect API is only supported when Stripe collects requirements on the platform (Custom). */
export function connectBanksDeletableViaPlatformApi(account: Stripe.Account): boolean {
  return account.controller?.requirement_collection === "application"
}

function marketplaceBusinessProfileUrl(origin: string, sellerSlug: string | null | undefined): string {
  const base = origin.replace(/\/$/, "")
  const slug = sellerSlug?.trim()
  if (slug) {
    return `${base}/sellers/${encodeURIComponent(slug)}`
  }
  return base
}

function splitPersonName(raw: string | null | undefined): { firstName?: string; lastName?: string } {
  const t = raw?.trim()
  if (!t) return {}
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

/** Stripe Connect expects E.164 for `individual.phone`. */
function toE164UsPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined
  const trimmed = phone.trim()
  if (trimmed.startsWith("+")) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return undefined
}

function buildIndividualAddressFromRow(
  addr: StripePrefillAddressRow | null,
): Stripe.AddressParam | undefined {
  if (!addr) return undefined
  const line1 = addr.line1?.trim()
  const city = addr.city?.trim()
  const postal = addr.postal_code?.trim()
  if (!line1 || !city || !postal) return undefined
  const country = (addr.country ?? "US").trim().toUpperCase()
  if (country !== "US") {
    return undefined
  }
  const a: Stripe.AddressParam = {
    line1,
    city,
    postal_code: postal,
    country: "US",
  }
  if (addr.line2?.trim()) {
    a.line2 = addr.line2.trim()
  }
  const state = toUsStateCode(addr.state)
  if (state) {
    a.state = state
  }
  return a
}

async function loadStripeConnectAccountPrefillParams(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<StripeConnectAccountPrefillFields> {
  const data = await getStripeConnectPrefillData(supabase, userId)
  const origin = publicSiteOrigin()
  const profile = data.profile
  const slug = profile?.seller_slug
  const businessUrl = marketplaceBusinessProfileUrl(origin, slug ?? null)

  const nameFromAddress = splitPersonName(data.address?.full_name)
  const nameFromProfile = splitPersonName(profile?.display_name)
  const firstName = nameFromAddress.firstName ?? nameFromProfile.firstName
  const lastName = nameFromAddress.lastName ?? nameFromProfile.lastName

  const individual: NonNullable<StripeConnectAccountPrefillFields["individual"]> = {}
  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    individual.email = trimmedEmail
  }
  if (firstName) {
    individual.first_name = firstName
  }
  if (lastName) {
    individual.last_name = lastName
  }
  const phone = toE164UsPhone(data.address?.phone)
  if (phone) {
    individual.phone = phone
  }
  const indAddress = buildIndividualAddressFromRow(data.address)
  if (indAddress) {
    individual.address = indAddress
  }

  const params: StripeConnectAccountPrefillFields = {
    business_type: "individual",
    business_profile: {
      url: businessUrl,
      product_description: MARKETPLACE_PRODUCT_DESCRIPTION,
    },
  }
  if (trimmedEmail) {
    params.email = trimmedEmail
  }
  if (Object.keys(individual).length > 0) {
    params.individual = individual
  }
  return params
}

/**
 * Syncs Reswell profile + default address into the connected account so Stripe onboarding asks for less
 * (business URL, description, name, phone, mailing address when we have them).
 */
export async function prefillConnectAccountMarketplaceBusinessProfile(
  supabase: SupabaseClient,
  stripeAccountId: string,
  userId: string,
  email: string | null,
): Promise<void> {
  const stripe = getStripe()
  try {
    const prefill = await loadStripeConnectAccountPrefillParams(supabase, userId, email)
    await stripe.accounts.update(stripeAccountId, prefill)
  } catch (e) {
    console.error("[stripe connect] prefillConnectAccountMarketplaceBusinessProfile", e)
  }
}

export async function ensureExpressConnectedAccount(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
): Promise<{ stripeAccountId: string } | { error: string }> {
  const existing = await getStripeConnectAccountByUserId(supabase, userId)
  if (existing) {
    return { stripeAccountId: existing.stripe_account_id }
  }

  const stripe = getStripe()
  const prefill = await loadStripeConnectAccountPrefillParams(supabase, userId, email)

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      ...prefill,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        reswell_user_id: userId,
      },
    })

    const inserted = await insertStripeConnectAccount(supabase, {
      user_id: userId,
      stripe_account_id: account.id,
    })

    if (!inserted) {
      try {
        await stripe.accounts.del(account.id)
      } catch {
        /* best effort cleanup */
      }
      return { error: "Could not save payout profile" }
    }

    await syncStripeConnectAccountRow(supabase, account.id)
    return { stripeAccountId: account.id }
  } catch (e) {
    console.error("[stripe connect] ensureExpressConnectedAccount", e)
    return { error: "Stripe could not create a payout profile. Try again shortly." }
  }
}

export async function createConnectAccountSessionClientSecret(
  stripeAccountId: string,
): Promise<{ clientSecret: string } | { error: string }> {
  const stripe = getStripe()
  try {
    // Express accounts: do not set disable_stripe_user_authentication — only valid when
    // requirement_collection is "application"; otherwise accountSessions.create fails.
    const session = await stripe.accountSessions.create({
      account: stripeAccountId,
      components: {
        account_onboarding: {
          enabled: true,
        },
        account_management: {
          enabled: true,
          features: {
            // Ensures payout bank linking/editing is fully available in embedded UI (Express).
            external_account_collection: true,
          },
        },
      },
    })
    if (!session.client_secret) {
      return { error: "Stripe did not return a session" }
    }
    return { clientSecret: session.client_secret }
  } catch (e) {
    console.error("[stripe connect] createConnectAccountSessionClientSecret", e)
    return { error: "Could not start the secure bank setup flow." }
  }
}

export interface ConnectBankAccountSummary {
  id: string
  last4: string | null
  bankName: string | null
  defaultForCurrency: boolean
  currency: string
}

export async function listExternalBankAccountsForConnectAccount(
  stripeAccountId: string,
): Promise<ConnectBankAccountSummary[]> {
  const stripe = getStripe()
  const result = await stripe.accounts.listExternalAccounts(stripeAccountId, {
    object: "bank_account",
    limit: 100,
  })
  return result.data.map((ex) => {
    const b = ex as Stripe.BankAccount
    return {
      id: b.id,
      last4: b.last4 ?? null,
      bankName: b.bank_name ?? null,
      defaultForCurrency: Boolean(b.default_for_currency),
      currency: typeof b.currency === "string" ? b.currency : "usd",
    }
  })
}

export type ConnectBankMutationResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

export async function deleteConnectBankAccount(
  supabase: SupabaseClient,
  userId: string,
  externalAccountId: string,
): Promise<ConnectBankMutationResult> {
  const row = await getStripeConnectAccountByUserId(supabase, userId)
  if (!row?.stripe_account_id) {
    return { ok: false, error: "No bank payout profile found.", status: 400 }
  }

  const stripe = getStripe()
  try {
    await stripe.accounts.deleteExternalAccount(row.stripe_account_id, externalAccountId)
  } catch (e) {
    console.error("[stripe connect] deleteExternalAccount", e)
    // Bank delete via API is only supported for Custom Connect accounts (requirement_collection: application).
    // Express accounts must add/remove banks through Stripe Connect embedded account management.
    if (e instanceof Stripe.errors.StripePermissionError) {
      return {
        ok: false,
        error:
          "Removing this bank from the app isn’t available for your account type. Use Earnings → Add or manage banks to open Stripe and update payout accounts there.",
        status: 403,
      }
    }
    if (e instanceof Stripe.errors.StripeInvalidRequestError) {
      return {
        ok: false,
        error:
          "Stripe could not remove this bank. If it’s your only payout account, add another bank first, then set it as default, or use Add or manage banks in Stripe.",
        status: 400,
      }
    }
    return { ok: false, error: "Could not remove this bank account. Try again.", status: 502 }
  }

  await syncStripeConnectAccountRow(supabase, row.stripe_account_id)
  return { ok: true }
}

export async function setDefaultConnectBankAccount(
  supabase: SupabaseClient,
  userId: string,
  externalAccountId: string,
): Promise<ConnectBankMutationResult> {
  const row = await getStripeConnectAccountByUserId(supabase, userId)
  if (!row?.stripe_account_id) {
    return { ok: false, error: "No bank payout profile found.", status: 400 }
  }

  const stripe = getStripe()
  try {
    await stripe.accounts.updateExternalAccount(row.stripe_account_id, externalAccountId, {
      default_for_currency: true,
    })
  } catch (e) {
    console.error("[stripe connect] updateExternalAccount default", e)
    return { ok: false, error: "Could not set the default bank. Try again.", status: 502 }
  }

  await syncStripeConnectAccountRow(supabase, row.stripe_account_id)
  return { ok: true }
}

export type ConnectCashOutResult =
  | {
      ok: true
      transferId: string
      amountUsd: number
      message: string
    }
  | { ok: false; error: string; status?: number }

export async function cashOutToStripeConnectedAccount(
  supabase: SupabaseClient,
  userId: string,
  amountUsdRaw: number,
): Promise<ConnectCashOutResult> {
  const amountUsd = roundMoney(amountUsdRaw)
  if (amountUsd < 10) {
    return { ok: false, error: "Minimum payout amount is $10.00", status: 400 }
  }

  const row = await getStripeConnectAccountByUserId(supabase, userId)
  if (!row?.stripe_account_id) {
    return {
      ok: false,
      error: "Add a bank account for ACH payouts before cashing out.",
      status: 400,
    }
  }

  let { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", userId).single()

  if (!wallet) {
    const { data: inserted, error: insertErr } = await supabase
      .from("wallets")
      .insert({ user_id: userId })
      .select("*")
      .single()
    if (insertErr || !inserted) {
      return { ok: false, error: "Could not load wallet", status: 500 }
    }
    wallet = inserted
  }

  const agg = reconcileWalletAggregates(wallet)
  if (agg.needsPersist) {
    const s = walletAggregateStrings(agg)
    await supabase
      .from("wallets")
      .update({
        balance: s.balance,
        lifetime_cashed_out: s.lifetime_cashed_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
    wallet = { ...wallet, balance: s.balance, lifetime_cashed_out: s.lifetime_cashed_out }
  }

  const available = roundMoney(parseFloat(String(wallet.balance)))
  if (available < amountUsd) {
    return {
      ok: false,
      error: `Insufficient balance. Available: $${available.toFixed(2)}`,
      status: 400,
    }
  }

  const stripe = getStripe()
  const amountCents = Math.round(amountUsd * 100)

  let platformAvailableCents: number
  try {
    platformAvailableCents = await getPlatformAvailableUsdCents(stripe)
  } catch (e) {
    console.error("[stripe connect] balance.retrieve before transfer", e)
    return {
      ok: false,
      error: "Could not verify payout funds. Try again shortly.",
      status: 502,
    }
  }

  if (platformAvailableCents < amountCents) {
    console.warn("[stripe connect] platform balance insufficient for transfer", {
      platformAvailableCents,
      amountCents,
      userId,
    })
    return {
      ok: false,
      error:
        "Your app balance is available, but settled card funds in Stripe aren’t enough for this transfer yet. " +
        "This often happens while recent charges are still pending (typically a few business days), or if wallet " +
        "credits didn’t come from Stripe card payments. Try again after more sales settle, or contact support.",
      status: 400,
    }
  }

  let connected: Stripe.Account
  try {
    connected = await stripe.accounts.retrieve(row.stripe_account_id)
  } catch (e) {
    console.error("[stripe connect] accounts.retrieve before transfer", e)
    return {
      ok: false,
      error: "Could not verify your payout profile. Try again or open Manage payout banks in Stripe.",
      status: 502,
    }
  }

  await syncStripeConnectAccountRow(supabase, connected.id)

  if (!connected.payouts_enabled) {
    return {
      ok: false,
      error: "Complete bank setup and verification before cashing out.",
      status: 400,
    }
  }

  if (connected.capabilities?.transfers !== "active") {
    return {
      ok: false,
      error:
        "Stripe hasn’t finished activating transfers on your payout profile. Open Manage payout banks and complete any verification Stripe requests.",
      status: 400,
    }
  }

  const transferRowId = randomUUID()

  let transfer: Stripe.Transfer
  try {
    transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: "usd",
        destination: row.stripe_account_id,
        metadata: {
          reswell_connect_transfer_id: transferRowId,
          reswell_user_id: userId,
        },
      },
      {
        idempotencyKey: `connect_cashout_${transferRowId}`,
      },
    )
  } catch (e) {
    console.error("[stripe connect] transfers.create", e)
    return {
      ok: false,
      error: userFacingMessageForStripeTransferError(e),
      status: 502,
    }
  }

  const { error: insertErr } = await supabase.from("stripe_connect_transfers").insert({
    id: transferRowId,
    user_id: userId,
    amount: amountUsd,
    stripe_transfer_id: transfer.id,
    status: "SUCCEEDED",
  })

  if (insertErr) {
    console.error("[stripe connect] stripe_connect_transfers insert", insertErr)
    return {
      ok: false,
      error: "Payout recorded in Stripe but not in Reswell. Contact support with your transfer id.",
      status: 500,
    }
  }

  const newBalance = roundMoney(available - amountUsd)
  const { error: walletErr } = await supabase
    .from("wallets")
    .update({
      balance: newBalance,
      lifetime_cashed_out: roundMoney(parseFloat(String(wallet.lifetime_cashed_out)) + amountUsd),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (walletErr) {
    console.error("[stripe connect] wallet update after transfer", walletErr)
  }

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: userId,
    type: "cashout",
    amount: -amountUsd,
    balance_after: newBalance,
    description: `Cash-out $${amountUsd.toFixed(2)} via bank (Stripe, fee: $0.00, transfer: ${transfer.id})`,
    status: "completed",
    reference_id: transferRowId,
    reference_type: "stripe_connect_transfer",
  })

  if (txErr) {
    console.error("[stripe connect] wallet_transactions insert", txErr)
  }

  return {
    ok: true,
    transferId: transfer.id,
    amountUsd,
    message: `Sent $${amountUsd.toFixed(2)} to your Stripe balance — your bank will receive it on Stripe’s payout schedule (typically 2–3 business days).`,
  }
}
