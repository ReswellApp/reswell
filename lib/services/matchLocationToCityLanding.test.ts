import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { matchLocationToCityLanding } from "./matchLocationToCityLanding.ts"

const cities = [
  {
    slug: "san-diego",
    city: "San Diego",
    state: "CA",
    href: "/reswell/san-diego",
    label: "San Diego, CA",
  },
  {
    slug: "santa-barbara",
    city: "Santa Barbara",
    state: "CA",
    href: "/reswell/santa-barbara",
    label: "Santa Barbara, CA",
  },
  {
    slug: "la-jolla",
    city: "La Jolla",
    state: "CA",
    href: "/reswell/la-jolla",
    label: "La Jolla, CA",
  },
  {
    slug: "springfield-il",
    city: "Springfield",
    state: "IL",
    href: "/reswell/springfield-il",
    label: "Springfield, IL",
  },
  {
    slug: "springfield-mo",
    city: "Springfield",
    state: "MO",
    href: "/reswell/springfield-mo",
    label: "Springfield, MO",
  },
] as const

describe("matchLocationToCityLanding", () => {
  it("matches a Google-style city label", () => {
    const match = matchLocationToCityLanding(
      { label: "San Diego, CA, USA" },
      cities,
    )
    assert.equal(match?.slug, "san-diego")
  })

  it("matches structured city and state from a suggestion", () => {
    const match = matchLocationToCityLanding(
      { label: "San Diego, CA, USA", city: "San Diego", state: "California" },
      cities,
    )
    assert.equal(match?.slug, "san-diego")
  })

  it("matches a unique city name without a state", () => {
    const match = matchLocationToCityLanding({ label: "Santa Barbara" }, cities)
    assert.equal(match?.slug, "santa-barbara")
  })

  it("prefers the more specific locality in a compound label", () => {
    const match = matchLocationToCityLanding(
      { label: "La Jolla, San Diego, CA, USA" },
      cities,
    )
    assert.equal(match?.slug, "la-jolla")
  })

  it("falls back to the parent city when the neighborhood has no landing", () => {
    const withoutLaJolla = cities.filter((city) => city.slug !== "la-jolla")
    const match = matchLocationToCityLanding(
      { label: "La Jolla, San Diego, CA, USA" },
      withoutLaJolla,
    )
    assert.equal(match?.slug, "san-diego")
  })

  it("does not guess among duplicate city names without a state", () => {
    const match = matchLocationToCityLanding({ label: "Springfield" }, cities)
    assert.equal(match, null)
  })

  it("resolves a duplicate city name when the state is present", () => {
    const match = matchLocationToCityLanding(
      { label: "Springfield, IL" },
      cities,
    )
    assert.equal(match?.slug, "springfield-il")
  })

  it("returns null for a ZIP or an unknown place", () => {
    assert.equal(matchLocationToCityLanding({ label: "92109" }, cities), null)
    assert.equal(matchLocationToCityLanding({ label: "Atlantis, CA" }, cities), null)
    assert.equal(matchLocationToCityLanding({ label: "" }, cities), null)
  })
})
