import type { Stripe } from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

export function v2RecipientTransfersActive(
  account: Stripe.V2.Core.Account
): boolean {
  return (
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status === "active"
  )
}

export function v2RequirementsSummaryStatus(
  account: Stripe.V2.Core.Account
): string | undefined {
  return account.requirements?.summary?.minimum_deadline?.status
}

export function v2OnboardingComplete(account: Stripe.V2.Core.Account): boolean {
  const s = v2RequirementsSummaryStatus(account)
  if (s === undefined) return true
  return s !== "currently_due" && s !== "past_due"
}

export async function persistSellerAccountFromV2Account(
  supabase: SupabaseClient,
  account: Stripe.V2.Core.Account
): Promise<void> {
  const ready = v2RecipientTransfersActive(account)
  const onboardingDone = v2OnboardingComplete(account)

  const req = v2RequirementsSummaryStatus(account)
  let accountStatus: "PENDING" | "ACTIVE" | "RESTRICTED" | "DISABLED" = "PENDING"
  if (ready && onboardingDone) accountStatus = "ACTIVE"
  else if (!onboardingDone || req === "currently_due" || req === "past_due" || !ready) {
    accountStatus = "RESTRICTED"
  }

  await supabase
    .from("seller_stripe_accounts")
    .update({
      payouts_enabled: ready,
      charges_enabled: ready,
      details_submitted: onboardingDone,
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id)
}
