/** Shared Connect payout readiness helpers for API + Earnings UI. */

export interface StripeConnectBankAccountSummary {
  id: string
  last4: string | null
  bankName: string | null
  defaultForCurrency: boolean
  currency: string
}

/** Mirrors `@stripe/connect-js` CollectionOptions — kept here so API + UI share one shape. */
export interface ConnectCollectionOptionsPayload {
  fields: "currently_due" | "eventually_due"
  futureRequirements?: "omit" | "include"
  requirements?:
    | {
        only: string[]
      }
    | {
        exclude: string[]
      }
}

export type PayoutSetupStatus =
  | "ready"
  /** Seller can complete missing fields in embedded Stripe onboarding. */
  | "action_required"
  /** Submitted — Stripe is reviewing; UI should not ask to re-enter the same info. */
  | "pending_review"
  /** Payouts paused with nothing left to submit in the form — support / Stripe review. */
  | "restricted"

export interface StripeConnectStatusPayload {
  hasAccount: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  bankLast4: string | null
  bankName: string | null
  defaultExternalAccountId: string | null
  bankAccounts?: StripeConnectBankAccountSummary[]
  bankAccountsDeletableViaPlatformApi?: boolean
  cashOutReady: boolean
  bankLinked: boolean
  setupStatus: PayoutSetupStatus
  /** @deprecated Prefer `setupStatus === "action_required"`. */
  verificationNeeded: boolean
  verificationMessage: string | null
  requirementsChecklist: string[]
  /** @deprecated Prefer `collectionOptions`. */
  collectionFields: "currently_due" | "eventually_due"
  collectionOptions: ConnectCollectionOptionsPayload
}

const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.dob.day": "Date of birth",
  "individual.dob.month": "Date of birth",
  "individual.dob.year": "Date of birth",
  "individual.ssn_last_4": "Last 4 digits of your SSN",
  "individual.first_name": "Legal first name",
  "individual.last_name": "Legal last name",
  "individual.address.line1": "Home address",
  "individual.address.city": "Home address",
  "individual.address.state": "Home address",
  "individual.address.postal_code": "Home address",
  "individual.id_number": "Identity verification",
  "individual.verification.document": "Photo ID",
  external_account: "US bank account for payouts",
  "business_profile.url": "Business profile",
  "business_profile.mcc": "Business category",
}

function uniqueLabels(fields: string[]): string[] {
  const labels = new Set<string>()
  for (const field of fields) {
    const label = REQUIREMENT_LABELS[field] ?? field.replace(/\./g, " ").replace(/_/g, " ")
    labels.add(label)
  }
  return [...labels]
}

export function isStripeIdentityIncomplete(
  individual:
    | {
        dob?: { day?: number | null; month?: number | null; year?: number | null } | null
        ssn_last_4_provided?: boolean | null
      }
    | null
    | undefined,
): boolean {
  if (!individual) return true
  const hasDob = Boolean(individual.dob?.day && individual.dob?.month && individual.dob?.year)
  const hasSsn = individual.ssn_last_4_provided === true
  return !hasDob || !hasSsn
}

export function buildRequirementsChecklist(params: {
  payoutsEnabled: boolean
  bankLinked: boolean
  pastDue: string[]
  currentlyDue: string[]
  eventuallyDue: string[]
  identityIncomplete: boolean
}): string[] {
  if (params.payoutsEnabled) return []

  const urgent = [...params.pastDue, ...params.currentlyDue]
  if (urgent.length > 0) return uniqueLabels(urgent)

  // Trust Stripe's requirement arrays only — never invent DOB/SSN when Stripe lists nothing due.
  // Inventing fields keeps users in a verification loop after they already submitted.
  if (params.eventuallyDue.length > 0) return uniqueLabels(params.eventuallyDue)

  if (!params.bankLinked) {
    return ["US bank account for payouts", "Legal name and identity verification"]
  }

  void params.identityIncomplete
  return []
}

export function resolveConnectCollectionFields(params: {
  pastDue: string[]
  currentlyDue: string[]
}): "currently_due" | "eventually_due" {
  if (params.pastDue.length > 0 || params.currentlyDue.length > 0) {
    return "currently_due"
  }
  return "eventually_due"
}

export function buildConnectCollectionOptions(input: {
  pastDue: string[]
  currentlyDue: string[]
  eventuallyDue: string[]
  identityIncomplete: boolean
}): ConnectCollectionOptionsPayload {
  void input.identityIncomplete
  // Bank already linked + identity still eventually due → must request eventually_due or the
  // embedded form has nothing to show (currently_due is empty) and exits immediately.
  const fields =
    input.eventuallyDue.length > 0 &&
    input.pastDue.length === 0 &&
    input.currentlyDue.length === 0
      ? "eventually_due"
      : resolveConnectCollectionFields({
          pastDue: input.pastDue,
          currentlyDue: input.currentlyDue,
        })

  return { fields, futureRequirements: "include" }
}

export function resolvePayoutSetupStatus(input: {
  payoutsEnabled: boolean
  cashOutReady: boolean
  bankLinked: boolean
  pastDue: string[]
  currentlyDue: string[]
  eventuallyDue: string[]
  pendingVerification: string[]
  identityIncomplete: boolean
  disabledReason: string | null
}): PayoutSetupStatus {
  if (input.cashOutReady) return "ready"

  void input.identityIncomplete
  void input.disabledReason

  const urgent = [...input.pastDue, ...input.currentlyDue]
  // Only ask users to fill a form when Stripe still lists collectible fields (or no bank yet).
  const hasCollectibleFields =
    urgent.length > 0 || input.eventuallyDue.length > 0 || !input.bankLinked

  if (hasCollectibleFields) return "action_required"

  if (input.pendingVerification.length > 0) return "pending_review"

  // Payouts still off, nothing left to submit → stop the verification loop.
  if (!input.payoutsEnabled) return "restricted"

  return "restricted"
}

export function buildVerificationMessage(params: {
  setupStatus: PayoutSetupStatus
  bankLinked: boolean
  pastDue: string[]
  currentlyDue: string[]
  eventuallyDue: string[]
  identityIncomplete: boolean
}): string | null {
  if (params.setupStatus === "ready") return null

  if (params.setupStatus === "pending_review") {
    return "Stripe is reviewing the details you submitted. This usually takes a few minutes — use Refresh on this page shortly. You do not need to enter them again."
  }

  if (params.setupStatus === "restricted") {
    return "Stripe has paused payouts on this account and there is nothing left to submit in the form. Contact Reswell support if this continues."
  }

  const actionFields = [...params.pastDue, ...params.currentlyDue]
  if (actionFields.length === 0 && !params.bankLinked) {
    return "Connect a US bank account and complete Stripe identity verification to cash out."
  }

  if (actionFields.length > 0) {
    const labels = uniqueLabels(actionFields)
    if (labels.length === 1) {
      return `Stripe needs ${labels[0]} before payouts can be enabled.`
    }
    return `Stripe still needs: ${labels.slice(0, 3).join(", ")}.`
  }

  if (!params.bankLinked) {
    return "Connect a US bank account in Stripe before you can cash out."
  }

  const eventual = uniqueLabels(params.eventuallyDue)
  if (eventual.length > 0) {
    return `Your bank is connected. Stripe still needs ${eventual.join(" and ")} — use the legal name on your ID.`
  }

  void params.identityIncomplete
  return "Finish the remaining steps in Stripe before cashing out."
}

export function deriveConnectStatusFields(input: {
  hasAccount: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  bankLast4: string | null
  bankName: string | null
  defaultExternalAccountId: string | null
  bankAccounts: StripeConnectBankAccountSummary[]
  bankAccountsDeletableViaPlatformApi: boolean
  pastDue?: string[]
  currentlyDue?: string[]
  eventuallyDue?: string[]
  pendingVerification?: string[]
  disabledReason?: string | null
  identityIncomplete?: boolean
}): StripeConnectStatusPayload {
  const bankLinked =
    input.bankAccounts.some((b) => Boolean(b.last4)) || Boolean(input.bankLast4?.trim())

  const cashOutReady = input.payoutsEnabled && bankLinked

  const pastDue = input.pastDue ?? []
  const currentlyDue = input.currentlyDue ?? []
  const eventuallyDue = input.eventuallyDue ?? []
  const pendingVerification = input.pendingVerification ?? []
  const identityIncomplete = input.identityIncomplete ?? false
  const disabledReason = input.disabledReason ?? null

  const setupStatus = resolvePayoutSetupStatus({
    payoutsEnabled: input.payoutsEnabled,
    cashOutReady,
    bankLinked,
    pastDue,
    currentlyDue,
    eventuallyDue,
    pendingVerification,
    identityIncomplete,
    disabledReason,
  })

  const verificationNeeded = setupStatus === "action_required"

  const verificationMessage = buildVerificationMessage({
    setupStatus,
    bankLinked,
    pastDue,
    currentlyDue,
    eventuallyDue,
    identityIncomplete,
  })

  const requirementsChecklist = buildRequirementsChecklist({
    payoutsEnabled: input.payoutsEnabled,
    bankLinked,
    pastDue,
    currentlyDue,
    eventuallyDue,
    identityIncomplete,
  })

  const collectionOptions = buildConnectCollectionOptions({
    pastDue,
    currentlyDue,
    eventuallyDue,
    identityIncomplete,
  })

  return {
    hasAccount: input.hasAccount,
    payoutsEnabled: input.payoutsEnabled,
    detailsSubmitted: input.detailsSubmitted,
    bankLast4: input.bankLast4,
    bankName: input.bankName,
    defaultExternalAccountId: input.defaultExternalAccountId,
    bankAccounts: input.bankAccounts,
    bankAccountsDeletableViaPlatformApi: input.bankAccountsDeletableViaPlatformApi,
    cashOutReady,
    bankLinked,
    setupStatus,
    verificationNeeded,
    verificationMessage,
    requirementsChecklist,
    collectionFields: collectionOptions.fields,
    collectionOptions,
  }
}
