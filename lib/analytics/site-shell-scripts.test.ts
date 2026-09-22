import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

describe("public site shell script loading", () => {
  it("keeps Klaviyo, PostHog identify, page-view trackers, and Vercel Analytics out of the root layout", () => {
    const layout = readRepoFile("app/layout.tsx")
    assert.match(layout, /DeferredMarketingRuntime/)
    assert.doesNotMatch(layout, /KlaviyoOnsite/)
    assert.doesNotMatch(layout, /KlaviyoPageViewTracker/)
    assert.doesNotMatch(layout, /MetaPixelPageViewTracker/)
    assert.doesNotMatch(layout, /PostHogIdentify/)
    assert.doesNotMatch(layout, /@vercel\/analytics/)
  })

  it("loads remaining document pixels with lazyOnload", () => {
    for (const file of [
      "components/google-ads-gtag.tsx",
      "components/google-analytics-gtag.tsx",
      "components/meta-pixel.tsx",
      "components/openai-ads-pixel.tsx",
      "components/klaviyo-onsite.tsx",
    ]) {
      const source = readRepoFile(file)
      assert.match(source, /strategy="lazyOnload"/, `${file} should use lazyOnload`)
      assert.doesNotMatch(source, /strategy="afterInteractive"/, `${file} should not use afterInteractive`)
    }
  })

  it("does not statically import posthog-js from instrumentation-client", () => {
    const source = readRepoFile("instrumentation-client.ts")
    assert.doesNotMatch(source, /from ['"]posthog-js['"]/)
    assert.match(source, /deferUntilIdleOrInteraction/)
    assert.match(source, /init-posthog-client/)
  })
})
