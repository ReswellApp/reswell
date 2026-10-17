import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardAlertListingContent,
  listingListedAfterSavedSearch,
} from "./savedSearchAlertEligibility.ts"

const SAVED_AT = "2026-10-16T16:00:00.000Z"
const LISTED_AFTER = "2026-10-16T16:05:00.000Z"
const LISTED_BEFORE = "2026-10-16T15:59:00.000Z"

describe("listingListedAfterSavedSearch", () => {
  it("allows a listing that went live after the search was saved", () => {
    assert.equal(listingListedAfterSavedSearch(LISTED_AFTER, SAVED_AT), true)
  })

  it("rejects a listing that was already live when the search was saved", () => {
    assert.equal(listingListedAfterSavedSearch(LISTED_BEFORE, SAVED_AT), false)
  })

  it("rejects a listing listed at the same instant as the save", () => {
    assert.equal(listingListedAfterSavedSearch(SAVED_AT, SAVED_AT), false)
  })

  it("rejects missing or unparseable timestamps", () => {
    assert.equal(listingListedAfterSavedSearch(null, SAVED_AT), false)
    assert.equal(listingListedAfterSavedSearch(LISTED_AFTER, ""), false)
    assert.equal(listingListedAfterSavedSearch("not-a-date", SAVED_AT), false)
  })
})

describe("boardAlertListingContent", () => {
  it("accepts a listing with a title, price, and absolute link", () => {
    assert.deepEqual(
      boardAlertListingContent({
        title: "  CI Happy Everyday  ",
        price: "825",
        listingUrl: "https://www.reswell.app/l/ci-happy-everyday",
      }),
      {
        title: "CI Happy Everyday",
        price: 825,
        listingUrl: "https://www.reswell.app/l/ci-happy-everyday",
      },
    )
  })

  it("rejects an empty title, price, or link so the email cannot go out blank", () => {
    assert.equal(
      boardAlertListingContent({
        title: "   ",
        price: 400,
        listingUrl: "https://www.reswell.app/l/board",
      }),
      null,
    )
    assert.equal(
      boardAlertListingContent({
        title: "Board",
        price: "",
        listingUrl: "https://www.reswell.app/l/board",
      }),
      null,
    )
    assert.equal(
      boardAlertListingContent({
        title: "Board",
        price: 0,
        listingUrl: "https://www.reswell.app/l/board",
      }),
      null,
    )
    assert.equal(
      boardAlertListingContent({
        title: "Board",
        price: 400,
        listingUrl: "",
      }),
      null,
    )
    assert.equal(
      boardAlertListingContent({
        title: "Board",
        price: 400,
        listingUrl: "/l/board",
      }),
      null,
    )
  })
})
