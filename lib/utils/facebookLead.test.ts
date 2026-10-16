import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractPublicFacebookName,
  facebookNameIsAutomatic,
  leadNameFromFacebook,
  parseFacebookProfileInput,
  parseFacebookThreadInput,
} from "./facebookLead.ts"
import { contactCircleBackDue } from "./crmFollowUp.ts"

describe("parseFacebookProfileInput", () => {
  it("reads a numeric profile id from profile.php", () => {
    const parsed = parseFacebookProfileInput("https://www.facebook.com/profile.php?id=100012345678901")
    assert.equal(parsed?.profileId, "100012345678901")
    assert.equal(parsed?.profileUrl, "https://www.facebook.com/profile.php?id=100012345678901")
    assert.equal(parsed?.username, null)
  })

  it("reads a name and id from a people link", () => {
    const parsed = parseFacebookProfileInput(
      "https://m.facebook.com/people/Jane-Surfer/100012345678901/",
    )
    assert.equal(parsed?.profileId, "100012345678901")
    assert.equal(parsed?.displayName, "Jane Surfer")
    assert.equal(parsed?.profileUrl, "https://www.facebook.com/profile.php?id=100012345678901")
  })

  it("reads a marketplace profile id and a vanity username", () => {
    const market = parseFacebookProfileInput("https://www.facebook.com/marketplace/profile/1000999888777/")
    assert.equal(market?.profileId, "1000999888777")
    const vanity = parseFacebookProfileInput("fb.com/jane.doe")
    assert.equal(vanity?.username, "jane.doe")
    assert.equal(vanity?.profileUrl, "https://www.facebook.com/jane.doe")
  })

  it("accepts a bare profile id and rejects a homepage", () => {
    assert.equal(parseFacebookProfileInput("100012345678901")?.profileId, "100012345678901")
    assert.equal(parseFacebookProfileInput("https://www.facebook.com/marketplace"), null)
    assert.equal(parseFacebookProfileInput("https://instagram.com/jane"), null)
  })
})

describe("parseFacebookThreadInput", () => {
  it("reads messenger, marketplace, and bare thread ids", () => {
    assert.equal(
      parseFacebookThreadInput("https://www.facebook.com/messages/t/555666777888999")?.threadUrl,
      "https://www.facebook.com/messages/t/555666777888999",
    )
    assert.equal(
      parseFacebookThreadInput("https://www.messenger.com/t/555666777888999/")?.threadId,
      "555666777888999",
    )
    assert.equal(
      parseFacebookThreadInput("https://www.facebook.com/marketplace/inbox/?thread_id=555666777888999")?.threadId,
      "555666777888999",
    )
    assert.equal(parseFacebookThreadInput("555666777888999")?.threadId, "555666777888999")
    assert.equal(parseFacebookThreadInput("123"), null)
  })
})

describe("extractPublicFacebookName", () => {
  it("uses a public title and ignores the login wall", () => {
    assert.equal(
      extractPublicFacebookName('<meta property="og:title" content="Jane Doe | Facebook" />'),
      "Jane Doe",
    )
    assert.equal(extractPublicFacebookName("<title>Log into Facebook</title>"), null)
    assert.equal(extractPublicFacebookName('<meta property="og:title" content="Facebook" />'), null)
  })
})

describe("leadNameFromFacebook", () => {
  it("prefers a public name, then the URL, then a placeholder", () => {
    const parsed = parseFacebookProfileInput("https://www.facebook.com/people/Jane-Surfer/100012345678901")
    assert.ok(parsed)
    assert.equal(leadNameFromFacebook({ parsed, publicName: "Jane Q Public" }).displayName, "Jane Q Public")
    assert.equal(leadNameFromFacebook({ parsed, publicName: null }).displayName, "Jane Surfer")
    const idOnly = parseFacebookProfileInput("100012345678901")
    assert.ok(idOnly)
    const fallback = leadNameFromFacebook({ parsed: idOnly, publicName: "Log in" })
    assert.equal(fallback.firstName, "Facebook")
    assert.equal(fallback.displayName, "Facebook 678901")
  })

  it("treats an untouched placeholder as automatic so a later name can replace it", () => {
    assert.equal(
      facebookNameIsAutomatic(
        { first_name: "Facebook", last_name: null, facebook_username: null },
        null,
      ),
      true,
    )
    assert.equal(
      facebookNameIsAutomatic(
        { first_name: "Alex", last_name: "Kim", facebook_username: "alex" },
        "Facebook 123456",
      ),
      false,
    )
  })
})

describe("contactCircleBackDue", () => {
  const open = {
    status: "lead" as const,
    next_follow_up_at: "2026-10-01T00:00:00.000Z",
    last_contacted_at: "2026-09-28T00:00:00.000Z",
    profile_id: null,
  }
  const now = Date.parse("2026-10-16T00:00:00.000Z")
  const quiet = { listedSurfboard: false, bought: false }

  it("flags an overdue lead who has not listed or bought", () => {
    assert.equal(contactCircleBackDue(open, quiet, now), true)
  })

  it("stays quiet after they list or buy, or before the follow-up date", () => {
    assert.equal(contactCircleBackDue(open, { listedSurfboard: true, bought: false }, now), false)
    assert.equal(contactCircleBackDue(open, { listedSurfboard: false, bought: true }, now), false)
    assert.equal(
      contactCircleBackDue({ ...open, next_follow_up_at: "2026-10-20T00:00:00.000Z" }, quiet, now),
      false,
    )
    assert.equal(contactCircleBackDue({ ...open, status: "customer" }, quiet, now), false)
  })
})
