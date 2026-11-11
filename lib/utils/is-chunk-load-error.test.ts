import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, describe, it } from "node:test"
import {
  isChunkLoadError,
  isNextStaticAssetLoadFailure,
  isNextStaticAssetUrl,
  isPostHogChunkLoadError,
  recoverFromChunkLoadError,
} from "./is-chunk-load-error.ts"

describe("isChunkLoadError", () => {
  it("matches webpack ChunkLoadError by name", () => {
    const error = new Error("Loading chunk app/dashboard failed.")
    error.name = "ChunkLoadError"
    assert.equal(isChunkLoadError(error), true)
  })

  it("matches webpack, Turbopack, and dynamic-import messages", () => {
    assert.equal(isChunkLoadError("Loading CSS chunk 123 failed"), true)
    assert.equal(isChunkLoadError("Failed to load chunk /_next/static/chunks/app.js"), true)
    assert.equal(isChunkLoadError("Unable to preload CSS for /_next/static/css/app.css"), true)
    assert.equal(
      isChunkLoadError("Failed to fetch dynamically imported module: https://reswell.app/_next/static/chunks/x.js"),
      true,
    )
    assert.equal(isChunkLoadError("error loading dynamically imported module"), true)
    assert.equal(isChunkLoadError("Importing a module script failed."), true)
  })

  it("walks Error.cause", () => {
    const cause = new Error("Loading chunk abc failed")
    cause.name = "ChunkLoadError"
    assert.equal(isChunkLoadError(new Error("Next.js error", { cause })), true)
  })

  it("ignores unrelated errors", () => {
    assert.equal(isChunkLoadError(new Error("Cannot read properties of undefined")), false)
    assert.equal(isChunkLoadError("Failed to fetch"), false)
    assert.equal(isChunkLoadError(null), false)
  })
})

describe("isNextStaticAssetUrl / isNextStaticAssetLoadFailure", () => {
  it("detects hashed Next.js asset URLs", () => {
    assert.equal(isNextStaticAssetUrl("https://reswell.app/_next/static/chunks/app.js"), true)
    assert.equal(isNextStaticAssetUrl("/_next/static/css/app.css"), true)
    assert.equal(isNextStaticAssetUrl("https://reswell.app/images/logo.png"), false)
    assert.equal(isNextStaticAssetUrl(""), false)
  })

  it("detects script and stylesheet element load failures", () => {
    const scriptEvent = {
      target: {
        tagName: "SCRIPT",
        src: "https://reswell.app/_next/static/chunks/webpack-abc.js",
      },
    } as unknown as Event
    const linkEvent = {
      target: {
        tagName: "LINK",
        href: "https://reswell.app/_next/static/css/app.css",
      },
    } as unknown as Event
    const imageEvent = {
      target: { tagName: "IMG", src: "https://reswell.app/_next/static/media/logo.png" },
    } as unknown as Event

    assert.equal(isNextStaticAssetLoadFailure(scriptEvent), true)
    assert.equal(isNextStaticAssetLoadFailure(linkEvent), true)
    assert.equal(isNextStaticAssetLoadFailure(imageEvent), false)
  })
})

describe("isPostHogChunkLoadError", () => {
  it("drops exception autocapture for ChunkLoadError", () => {
    assert.equal(
      isPostHogChunkLoadError({
        event: "$exception",
        properties: {
          $exception_type: "ChunkLoadError",
          $exception_message: "Loading chunk 123 failed.",
        },
      }),
      true,
    )
    assert.equal(
      isPostHogChunkLoadError({
        event: "$exception",
        properties: {
          $exception_list: [
            { type: "Error", value: "Failed to load chunk /_next/static/chunks/app.js" },
          ],
        },
      }),
      true,
    )
    assert.equal(
      isPostHogChunkLoadError({
        event: "$pageview",
        properties: { $exception_type: "ChunkLoadError" },
      }),
      false,
    )
    assert.equal(
      isPostHogChunkLoadError({
        event: "$exception",
        properties: { $exception_message: "TypeError: undefined is not an object" },
      }),
      false,
    )
  })
})

describe("recoverFromChunkLoadError", () => {
  const previousWindow = globalThis.window

  afterEach(() => {
    if (previousWindow) {
      globalThis.window = previousWindow
    } else {
      delete (globalThis as { window?: Window }).window
    }
  })

  it("reloads once, then refuses a second reload in the guard window", () => {
    const store = new Map<string, string>()
    let reloads = 0
    globalThis.window = {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
      },
      location: {
        href: "https://reswell.app/boards",
        reload: () => {
          reloads += 1
        },
      },
    } as unknown as Window & typeof globalThis

    assert.equal(recoverFromChunkLoadError(), true)
    assert.equal(reloads, 1)
    assert.equal(recoverFromChunkLoadError(), false)
    assert.equal(reloads, 1)
  })
})

describe("chunk-load recovery wiring", () => {
  it("filters ChunkLoadError from PostHog and recovers in every error boundary", () => {
    const read = (relative: string) =>
      readFileSync(new URL(relative, import.meta.url), "utf8")

    const posthog = read("../client/init-posthog-client.ts")
    assert.match(posthog, /isPostHogChunkLoadError/)

    const installer = read("../client/install-chunk-load-recovery.ts")
    assert.match(installer, /preventDefault/)
    assert.match(installer, /isNextStaticAssetLoadFailure/)

    for (const relative of [
      "../../app/error.tsx",
      "../../app/global-error.tsx",
      "../../app/sell/error.tsx",
      "../../app/messages/error.tsx",
      "../../app/dashboard/offers/error.tsx",
      "../../app/feature-requests/error.tsx",
    ]) {
      assert.match(read(relative), /useChunkLoadRecovery/)
    }
  })
})
