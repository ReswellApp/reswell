import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { runInNewContext } from "node:vm"
import {
  HEADER_CHROME_AVATAR_CLASS,
  HEADER_CHROME_BOOT_SCRIPT,
  HEADER_CHROME_HYDRATED_CLASS,
  HEADER_CHROME_INITIAL_CLASS,
  HEADER_CHROME_KNOWN_CLASS,
  HEADER_CHROME_SIGNED_OUT_STORAGE_KEY,
  HEADER_CHROME_SNAPSHOT_STORAGE_KEY,
  clearHeaderChromeSignOutLatch,
  headerChromeAvatarCssValue,
  markHeaderChromeSignedOut,
  parseHeaderChromeSnapshot,
  writeHeaderChromeSnapshot,
  type HeaderChromeSnapshot,
} from "./header-chrome-snapshot.ts"

function sampleSnapshot(overrides: Partial<HeaderChromeSnapshot> = {}): HeaderChromeSnapshot {
  return {
    v: 1,
    userId: "user-1",
    email: "surfer@example.com",
    displayName: "Kai",
    avatarUrl: "https://cdn.example.com/a.png",
    isAdmin: false,
    isShipper: false,
    isDropoffLocation: false,
    unreadMessages: 2,
    unreadSupport: 0,
    walletBalance: 12.5,
    ...overrides,
  }
}

describe("header chrome snapshot", () => {
  it("parses a remembered account and drops malformed payloads", () => {
    assert.deepEqual(parseHeaderChromeSnapshot(JSON.stringify(sampleSnapshot())), sampleSnapshot())
    assert.equal(parseHeaderChromeSnapshot(null), null)
    assert.equal(parseHeaderChromeSnapshot("{"), null)
    assert.equal(parseHeaderChromeSnapshot(JSON.stringify({ v: 1, userId: "" })), null)
    assert.equal(
      parseHeaderChromeSnapshot(JSON.stringify(sampleSnapshot({ avatarUrl: "javascript:alert(1)" }))),
      null,
    )
  })

  it("remembers shop accounts and ignores a broken shop list", () => {
    const shopAccess = {
      actorUserId: "user-1",
      activeAccountId: "shop-1",
      actingAsShop: true,
      shopLabel: "Hayden Garfields Shop",
      role: "staff" as const,
      actorEmail: "hayden@reswell.app",
      showEarnings: false,
      hasShopifyAccess: false,
      options: [
        { accountId: "user-1", label: "My account", role: "owner" as const },
        { accountId: "shop-1", label: "Hayden Garfields Shop", role: "staff" as const },
      ],
    }
    const withShop = sampleSnapshot({ shopAccess })
    assert.deepEqual(parseHeaderChromeSnapshot(JSON.stringify(withShop)), withShop)
    assert.deepEqual(
      parseHeaderChromeSnapshot(JSON.stringify({ ...sampleSnapshot(), shopAccess: { nope: true } })),
      sampleSnapshot(),
    )
    assert.deepEqual(
      parseHeaderChromeSnapshot(
        JSON.stringify({
          ...sampleSnapshot(),
          shopAccess: { ...shopAccess, actorUserId: "someone-else" },
        }),
      ),
      sampleSnapshot(),
    )
  })

  it("only allows http(s) and same-origin avatar urls in css", () => {
    assert.equal(
      headerChromeAvatarCssValue("https://cdn.example.com/a.png?w=64"),
      'url("https://cdn.example.com/a.png?w=64")',
    )
    assert.equal(headerChromeAvatarCssValue("/media/avatar.webp"), 'url("/media/avatar.webp")')
    assert.equal(headerChromeAvatarCssValue('https://cdn.example.com/a.png");color:red'), null)
    assert.equal(headerChromeAvatarCssValue("http://cdn.example.com/a.png"), null)
    assert.equal(headerChromeAvatarCssValue("javascript:alert(1)"), null)
  })

  it("boot script paints a recognized account before react and ignores guests", () => {
    const signedIn = runBoot({
      raw: JSON.stringify(sampleSnapshot({ displayName: "Kai", avatarUrl: "https://cdn.example.com/a.png" })),
      cookie: "",
    })
    assert.equal(signedIn.classes.has(HEADER_CHROME_KNOWN_CLASS), true)
    assert.equal(signedIn.classes.has(HEADER_CHROME_AVATAR_CLASS), true)
    assert.equal(signedIn.classes.has(HEADER_CHROME_INITIAL_CLASS), true)
    assert.equal(signedIn.props.get("--rw-header-initial"), '"K"')
    assert.equal(signedIn.props.get("--rw-header-avatar"), 'url("https://cdn.example.com/a.png")')

    const cookieOnly = runBoot({ raw: null, cookie: "sb-abc-auth-token=1" })
    assert.equal(cookieOnly.classes.has(HEADER_CHROME_KNOWN_CLASS), true)
    assert.equal(cookieOnly.classes.has(HEADER_CHROME_AVATAR_CLASS), false)

    const guest = runBoot({ raw: null, cookie: "rw_did=1" })
    assert.equal(guest.classes.has(HEADER_CHROME_KNOWN_CLASS), false)

    const signedOut = runBoot({
      raw: JSON.stringify(sampleSnapshot()),
      cookie: "sb-abc-auth-token=1",
      signedOut: true,
    })
    assert.equal(signedOut.classes.has(HEADER_CHROME_KNOWN_CLASS), false)
    assert.equal(signedOut.classes.has(HEADER_CHROME_AVATAR_CLASS), false)
    assert.equal(signedOut.storage.get(HEADER_CHROME_SNAPSHOT_STORAGE_KEY), undefined)
    assert.equal(signedOut.session.get(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY), undefined)

    const signedOutCookie = runBoot({
      raw: JSON.stringify(sampleSnapshot({ displayName: "Kai" })),
      cookie: `${HEADER_CHROME_SIGNED_OUT_STORAGE_KEY}=1; sb-abc-auth-token=1`,
    })
    assert.equal(signedOutCookie.classes.has(HEADER_CHROME_AVATAR_CLASS), false)
    assert.equal(signedOutCookie.storage.get(HEADER_CHROME_SNAPSHOT_STORAGE_KEY), undefined)

    const injected = runBoot({
      raw: JSON.stringify(sampleSnapshot({ avatarUrl: 'https://cdn.example.com/a.png");color:red' })),
      cookie: "",
    })
    assert.equal(injected.props.has("--rw-header-avatar"), false)
  })

  it("keeps the cached shell anonymous and the boot styles in sync", () => {
    const chrome = readFileSync(new URL("../../components/site-chrome.tsx", import.meta.url), "utf8")
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
    const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(chrome, /from ["']next\/headers["']/)
    assert.match(layout, /HEADER_CHROME_BOOT_SCRIPT/)
    assert.match(css, new RegExp(HEADER_CHROME_KNOWN_CLASS))
    assert.match(css, new RegExp(HEADER_CHROME_HYDRATED_CLASS))
    assert.match(HEADER_CHROME_BOOT_SCRIPT, new RegExp(HEADER_CHROME_SNAPSHOT_STORAGE_KEY))
    assert.match(HEADER_CHROME_BOOT_SCRIPT, new RegExp(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY))
  })

  it("does not write the remembered account after sign-out starts", () => {
    const store = new Map<string, string>()
    const session = new Map<string, string>([[HEADER_CHROME_SIGNED_OUT_STORAGE_KEY, "1"]])
    const previous = installStorage(store, session)
    try {
      markHeaderChromeSignedOut()
      writeHeaderChromeSnapshot(sampleSnapshot())
      assert.equal(store.get(HEADER_CHROME_SNAPSHOT_STORAGE_KEY), undefined)
    } finally {
      clearHeaderChromeSignOutLatch()
      restoreStorage(previous)
    }
  })
})

function runBoot(input: { raw: string | null; cookie: string; signedOut?: boolean }): {
  classes: Set<string>
  props: Map<string, string>
  storage: Map<string, string>
  session: Map<string, string>
} {
  const classes = new Set<string>()
  const props = new Map<string, string>()
  const storage = new Map<string, string>()
  const session = new Map<string, string>()
  if (input.raw) storage.set(HEADER_CHROME_SNAPSHOT_STORAGE_KEY, input.raw)
  if (input.signedOut) session.set(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY, "1")
  const context = {
    document: {
      cookie: input.cookie,
      documentElement: {
        classList: {
          add(name: string) {
            classes.add(name)
          },
        },
        style: {
          setProperty(name: string, value: string) {
            props.set(name, value)
          },
        },
      },
    },
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null
      },
      removeItem(key: string) {
        storage.delete(key)
      },
    },
    sessionStorage: {
      getItem(key: string) {
        return session.get(key) ?? null
      },
      removeItem(key: string) {
        session.delete(key)
      },
    },
    JSON,
  }
  runInNewContext(HEADER_CHROME_BOOT_SCRIPT, context)
  return { classes, props, storage, session }
}

function installStorage(store: Map<string, string>, session: Map<string, string>) {
  const target = globalThis as {
    window?: unknown
    localStorage?: unknown
    sessionStorage?: unknown
    document?: unknown
  }
  const previous = {
    window: target.window,
    localStorage: target.localStorage,
    sessionStorage: target.sessionStorage,
    document: target.document,
  }
  target.window = {}
  target.localStorage = mapStorage(store)
  target.sessionStorage = mapStorage(session)
  target.document = {
    documentElement: {
      classList: { remove() {} },
      style: { removeProperty() {} },
    },
  }
  return previous
}

function mapStorage(store: Map<string, string>) {
  return {
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
  }
}

function restoreStorage(previous: {
  window: unknown
  localStorage: unknown
  sessionStorage: unknown
  document: unknown
}) {
  const target = globalThis as {
    window?: unknown
    localStorage?: unknown
    sessionStorage?: unknown
    document?: unknown
  }
  target.window = previous.window
  target.localStorage = previous.localStorage
  target.sessionStorage = previous.sessionStorage
  target.document = previous.document
}
