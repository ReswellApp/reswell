import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { APP_LINK_AASA_PATHS } from "@reswell/api-contract"
import {
  androidAssetLinksFromEnv,
  androidSha256FingerprintsFromEnv,
  appleAppSiteAssociationFromEnv,
  buildAndroidAssetLinks,
  buildAppleAppSiteAssociation,
  normalizeSha256Fingerprint,
} from "./appLinks.ts"

const TEAM_ID = "AB12CD34EF"
const FINGERPRINT_HEX = "aa".repeat(32)
const FINGERPRINT_COLON =
  "AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA"

describe("buildAppleAppSiteAssociation", () => {
  it("embeds the team id and claimed website paths", () => {
    const body = buildAppleAppSiteAssociation({ teamId: TEAM_ID })
    const recent = body.applinks.details[0]
    assert.ok(recent && "appIDs" in recent)
    assert.deepEqual(recent.appIDs, [`${TEAM_ID}.app.reswell.reswell`])
    assert.ok(recent.components.some((component) => component["/"] === "/l/*"))
    assert.ok(recent.components.some((component) => component["/"] === "/dashboard/purchases/*"))
    assert.ok(!recent.components.some((component) => component["/"].startsWith("/track")))
    assert.ok(APP_LINK_AASA_PATHS.includes("/messages/*"))
  })

  it("returns null until APPLE_TEAM_ID is set", () => {
    assert.equal(appleAppSiteAssociationFromEnv({}), null)
    const body = appleAppSiteAssociationFromEnv({ APPLE_TEAM_ID: TEAM_ID })
    const recent = body?.applinks.details[0]
    assert.ok(recent && "appIDs" in recent)
    assert.deepEqual(recent.appIDs, [`${TEAM_ID}.app.reswell.reswell`])
  })
})

describe("buildAndroidAssetLinks", () => {
  it("normalizes fingerprints and skips an empty config", () => {
    assert.equal(normalizeSha256Fingerprint(FINGERPRINT_HEX), FINGERPRINT_COLON)
    const links = buildAndroidAssetLinks({ sha256CertFingerprints: [FINGERPRINT_HEX] })
    assert.equal(links[0]?.target.package_name, "app.reswell.mobile")
    assert.deepEqual(links[0]?.target.sha256_cert_fingerprints, [FINGERPRINT_COLON])
    assert.equal(androidAssetLinksFromEnv({}), null)
    assert.deepEqual(
      androidSha256FingerprintsFromEnv({
        ANDROID_APP_LINKS_SHA256_FINGERPRINTS: FINGERPRINT_HEX,
      }),
      [FINGERPRINT_COLON],
    )
  })
})
