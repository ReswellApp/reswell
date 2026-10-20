import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseAdminCohortsDashboard } from "@/lib/db/adminCohortsParse"

describe("parseAdminCohortsDashboard", () => {
  it("parses a valid dashboard payload", () => {
    const parsed = parseAdminCohortsDashboard({
      cohortMonths: 12,
      horizonMonths: 6,
      timezone: "America/Los_Angeles",
      activityDefinition: "Product activity",
      summary: {
        totalUsers: 100,
        returnedUsers: 40,
        returnedRate: 0.4,
        m1RetentionRate: 0.25,
        avgReturnMonths: 1.2,
      },
      cohorts: [
        {
          cohortMonth: "2026-09",
          size: 50,
          avgReturnMonths: 1.1,
          returnedUsers: 20,
          retention: [
            { offset: 0, users: 30, rate: 0.6, elapsed: true },
            { offset: 1, users: 10, rate: null, elapsed: false },
          ],
          returnFrequency: [
            { returns: 0, users: 30 },
            { returns: 1, users: 20 },
          ],
        },
      ],
    })

    assert.ok(parsed)
    assert.equal(parsed.cohortMonths, 12)
    assert.equal(parsed.summary.returnedRate, 0.4)
    assert.equal(parsed.cohorts[0]?.cohortMonth, "2026-09")
    assert.equal(parsed.cohorts[0]?.retention[1]?.rate, null)
    assert.equal(parsed.cohorts[0]?.returnFrequency[1]?.users, 20)
  })

  it("rejects malformed payloads", () => {
    assert.equal(parseAdminCohortsDashboard(null), null)
    assert.equal(parseAdminCohortsDashboard({ cohortMonths: 12 }), null)
    assert.equal(
      parseAdminCohortsDashboard({
        cohortMonths: 12,
        horizonMonths: 6,
        timezone: "America/Los_Angeles",
        activityDefinition: "x",
        summary: { totalUsers: 1, returnedUsers: 0 },
        cohorts: [{ cohortMonth: "2026-01", size: 1 }],
      }),
      null,
    )
  })
})
