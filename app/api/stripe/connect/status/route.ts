import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeConnectAccountByUserId } from "@/lib/db/stripeConnect"
import {
  type ConnectBankAccountSummary,
  connectBanksDeletableViaPlatformApi,
  listExternalBankAccountsForConnectAccount,
  syncStripeConnectAccountRow,
} from "@/lib/services/stripeConnect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const row = await getStripeConnectAccountByUserId(supabase, user.id)
  if (!row) {
    return NextResponse.json({
      hasAccount: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      bankLast4: null as string | null,
      bankName: null as string | null,
      defaultExternalAccountId: null as string | null,
      bankAccounts: [] as ConnectBankAccountSummary[],
      bankAccountsDeletableViaPlatformApi: false,
    })
  }

  let bankAccountsDeletableViaPlatformApi = false
  try {
    const account = await syncStripeConnectAccountRow(supabase, row.stripe_account_id)
    bankAccountsDeletableViaPlatformApi = connectBanksDeletableViaPlatformApi(account)
  } catch (e) {
    console.error("[stripe connect status] sync", e)
  }

  const fresh = await getStripeConnectAccountByUserId(supabase, user.id)

  let bankAccounts: Awaited<ReturnType<typeof listExternalBankAccountsForConnectAccount>> = []
  try {
    bankAccounts = await listExternalBankAccountsForConnectAccount(row.stripe_account_id)
  } catch (e) {
    console.error("[stripe connect status] list banks", e)
  }

  return NextResponse.json({
    hasAccount: true,
    payoutsEnabled: fresh?.payouts_enabled ?? false,
    detailsSubmitted: fresh?.details_submitted ?? false,
    bankLast4: fresh?.bank_last4 ?? null,
    bankName: fresh?.bank_name ?? null,
    defaultExternalAccountId: fresh?.default_external_account_id ?? null,
    bankAccounts,
    bankAccountsDeletableViaPlatformApi,
  })
}
