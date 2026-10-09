import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type {
  EmailProductBlock,
  EmailStudioProductSnapshot,
} from "../types/emailStudio"
import { validateEmailStudioPreflight } from "./preflight"
import { reconcileEmailStudioProductBlock } from "./product-reconciliation"

function productSnapshot(
  id: string,
  title: string,
): EmailStudioProductSnapshot {
  return {
    id,
    title,
    priceDisplay: "$500",
    condition: "Good",
    dimensions: "6'0″ × 20″ × 2.5″",
    boardType: "Shortboard",
    imageUrl: "https://www.reswell.app/board.jpg",
    productUrl: `https://www.reswell.app/l/${id}`,
    availability: "available",
  }
}

describe("email studio product reconciliation", () => {
  it("keeps missing listings removable and prunes snapshot-less orphan IDs", () => {
    const liveId = "00000000-0000-4000-8000-000000000001"
    const missingId = "00000000-0000-4000-8000-000000000002"
    const orphanId = "00000000-0000-4000-8000-000000000003"
    const unselectedId = "00000000-0000-4000-8000-000000000004"
    const block: EmailProductBlock = {
      id: "00000000-0000-4000-8000-000000000010",
      type: "product",
      title: "Featured boards",
      listingIds: [liveId, missingId, orphanId],
      items: [
        productSnapshot(liveId, "Stale live board"),
        productSnapshot(missingId, "Deleted board"),
      ],
      showPrice: true,
      showCondition: true,
      showDimensions: true,
      showBoardType: true,
      showAvailability: true,
      ctaLabel: "View board",
    }

    const reconciled = reconcileEmailStudioProductBlock(block, [
      productSnapshot(unselectedId, "Unselected board"),
      productSnapshot(liveId, "Fresh live board"),
    ])

    assert.deepEqual(reconciled.listingIds, [liveId, missingId])
    assert.deepEqual(
      reconciled.items.map(({ id, title, availability }) => ({
        id,
        title,
        availability,
      })),
      [
        { id: liveId, title: "Fresh live board", availability: "available" },
        { id: missingId, title: "Deleted board", availability: "unavailable" },
      ],
    )

    const issues = validateEmailStudioPreflight({
      subject: "Fresh boards",
      previewText: "Two boards to consider",
      document: {
        blocks: [
          reconciled,
          {
            id: "00000000-0000-4000-8000-000000000011",
            type: "footer",
            text: "Reswell marketplace updates",
            showUnsubscribe: true,
          },
        ],
      },
    })

    assert.equal(
      issues.some((issue) => issue.code === "missing-product-snapshot"),
      false,
    )
    assert.equal(
      issues.some((issue) => issue.code === "unavailable-product"),
      true,
    )
    assert.deepEqual(
      issues.filter((issue) => issue.severity === "error"),
      [],
    )
  })
})
