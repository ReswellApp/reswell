import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  APP_LINK_ANDROID_PATH_PREFIXES,
  APP_LINK_AASA_PATHS,
  APP_LINK_HOST,
  nativeIntentPath,
  webHrefToNativePath,
} from "@reswell/api-contract"

describe("webHrefToNativePath", () => {
  it("maps listing, order, and message email URLs onto native screens", () => {
    assert.equal(
      webHrefToNativePath("https://www.reswell.app/l/ci-happy-everyday"),
      "/listing/ci-happy-everyday",
    )
    assert.equal(
      webHrefToNativePath("/dashboard/purchases/44444444-4444-4444-8444-444444444444"),
      "/account/purchases/44444444-4444-4444-8444-444444444444",
    )
    assert.equal(
      webHrefToNativePath("/dashboard/sales/44444444-4444-4444-8444-444444444444"),
      "/account/sales/44444444-4444-4444-8444-444444444444",
    )
    assert.equal(
      webHrefToNativePath("https://www.reswell.app/messages/conv-1"),
      "/account/messages/conv-1",
    )
    assert.equal(webHrefToNativePath("/dashboard/offers"), "/account/offers")
    assert.equal(
      webHrefToNativePath("/dashboard/offers?tab=received&offer=44444444-4444-4444-8444-444444444444"),
      "/account/offers/44444444-4444-4444-8444-444444444444",
    )
    assert.equal(webHrefToNativePath("/checkout?listing=board"), "/account/checkout?listing=board")
    assert.equal(webHrefToNativePath("reswell://l/lost-puddle-jumper"), "/listing/lost-puddle-jumper")
    assert.equal(
      webHrefToNativePath("https://www.reswell.app/track/44444444-4444-4444-8444-444444444444"),
      "/track/44444444-4444-4444-8444-444444444444",
    )
  })

  it("maps help, safety, protection, and leftover seller-resource pages onto native screens", () => {
    assert.equal(webHrefToNativePath("https://www.reswell.app/help"), "/help")
    assert.equal(webHrefToNativePath("/help/selling"), "/help/selling")
    assert.equal(webHrefToNativePath("/help/buying/how-do-i-pay"), "/help/buying/how-do-i-pay")
    assert.equal(webHrefToNativePath("/safety"), "/safety")
    assert.equal(webHrefToNativePath("/protection-policy"), "/protection-policy")
    assert.equal(webHrefToNativePath("/shipping-estimator"), "/shipping-estimator")
    assert.equal(webHrefToNativePath("/dropoff/santa-barbara"), "/dropoff/santa-barbara")
    assert.equal(webHrefToNativePath("/for-surf-shops"), "/seller-resources/for-surf-shops")
    assert.equal(webHrefToNativePath("/auth/sign-up"), "/sign-in")
    assert.equal(webHrefToNativePath("/sell/boards?new=1"), "/sell/new?new=1")
    assert.equal(webHrefToNativePath("/track/abc"), null)
    assert.ok(APP_LINK_AASA_PATHS.includes("/help/*"))
  })
})

describe("nativeIntentPath", () => {
  it("rewrites claimed https links and sends unknown website URLs home", () => {
    assert.equal(
      nativeIntentPath("https://www.reswell.app/dashboard/purchases"),
      "/account/purchases",
    )
    assert.equal(nativeIntentPath("https://www.reswell.app/track/abc"), "/")
    assert.equal(
      nativeIntentPath("https://www.reswell.app/track/44444444-4444-4444-8444-444444444444"),
      "/track/44444444-4444-4444-8444-444444444444",
    )
    assert.equal(nativeIntentPath("/listing/board"), "/listing/board")
  })

  it("does not treat the Expo dev-client launch URL as a missing screen", () => {
    assert.equal(
      nativeIntentPath("reswell://expo-development-client?url=http://192.168.4.106:8082"),
      "/",
    )
    assert.equal(
      nativeIntentPath("reswell:///expo-development-client?url=http%3A%2F%2F192.168.4.106%3A8082"),
      "/",
    )
    assert.equal(
      nativeIntentPath("/expo-development-client?url=http%253A%252F%252F192.168.4.106%253A8082"),
      "/",
    )
  })
})

describe("mobile app link config", () => {
  it("claims the same https host and path prefixes as the mapper", () => {
    const appJson = JSON.parse(
      readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"),
    ) as {
      expo: {
        ios: { associatedDomains: string[] }
        android: { intentFilters: Array<{ data: Array<{ host: string; pathPrefix: string }> }> }
      }
    }
    assert.deepEqual(appJson.expo.ios.associatedDomains, [`applinks:${APP_LINK_HOST}`])
    const prefixes = appJson.expo.android.intentFilters[0]?.data.map((entry) => entry.pathPrefix) ?? []
    assert.deepEqual(prefixes, [...APP_LINK_ANDROID_PATH_PREFIXES])
  })
})
