import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildPayoutRequirementNotice,
  deriveConnectStatusFields,
  requirementSnapshotFromAccount,
} from "./stripe-connect-status.ts"

const emptyBanks = {
  hasAccount: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  bankLast4: "4242",
  bankName: "Test Bank",
  defaultExternalAccountId: "ba_123",
  bankAccounts: [
    {
      id: "ba_123",
      last4: "4242",
      bankName: "Test Bank",
      defaultForCurrency: true,
      currency: "usd",
    },
  ],
  bankAccountsDeletableViaPlatformApi: false,
}

describe("future Stripe requirements while payouts stay enabled", () => {
  it("keeps cash out available and lists the volume-threshold fields", () => {
    const status = deriveConnectStatusFields({
      ...emptyBanks,
      futureCurrentlyDue: ["individual.dob.day", "individual.dob.month", "individual.dob.year", "individual.ssn_last_4"],
    })

    assert.equal(status.cashOutReady, true)
    assert.equal(status.setupStatus, "ready")
    assert.deepEqual(status.requirementsChecklist, [])
    assert.deepEqual(status.upcomingRequirementsChecklist, [
      "Date of birth",
      "Last 4 digits of your SSN",
    ])
    assert.match(status.upcomingRequirementsMessage ?? "", /Date of birth and Last 4 digits of your SSN/)
    assert.equal(status.collectionOptions.futureRequirements, "include")
    assert.equal(status.collectionOptions.fields, "eventually_due")
    assert.deepEqual(status.urgentRequirementsChecklist, [])
    assert.equal(status.urgentRequirementsMessage, null)
  })

  it("treats currently due fields as urgent even while payouts are still on", () => {
    const status = deriveConnectStatusFields({
      ...emptyBanks,
      currentlyDue: ["individual.dob.day", "individual.ssn_last_4"],
      pastDue: ["individual.address.line1"],
    })

    assert.deepEqual(status.urgentRequirementsChecklist, [
      "Home address",
      "Date of birth",
      "Last 4 digits of your SSN",
    ])
    assert.match(status.urgentRequirementsMessage ?? "", /keep this payout account active/)
  })

  it("does not invent date of birth or SSN from eventually_due alone", () => {
    const status = deriveConnectStatusFields({
      ...emptyBanks,
      eventuallyDue: ["individual.dob.day", "individual.ssn_last_4"],
    })

    assert.equal(status.setupStatus, "ready")
    assert.deepEqual(status.upcomingRequirementsChecklist, [])
    assert.equal(status.upcomingRequirementsMessage, null)
  })

  it("notifies once per requirement set and clears when Stripe is satisfied", () => {
    const due = requirementSnapshotFromAccount({
      future_requirements: {
        currently_due: ["individual.ssn_last_4", "individual.dob.day"],
        current_deadline: null,
      },
    })
    const notice = buildPayoutRequirementNotice(due)
    assert.equal(notice?.fingerprint, "individual.dob.day|individual.ssn_last_4")
    assert.match(notice?.message ?? "", /Update this on Earnings/)

    const cleared = buildPayoutRequirementNotice(requirementSnapshotFromAccount({}))
    assert.equal(cleared, null)
  })
})
