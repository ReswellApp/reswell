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
  HEADER_CHROME_SNAPSHOT_STORAGE_KEY,
  headerChromeAvatarCssValue,
  parseHeaderChromeSnapshot,
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
  })
})

function runBoot(input: { raw: string | null; cookie: string }): {
  classes: Set<string>
  props: Map<string, string>
} {
  const classes = new Set<string>()
  const props = new Map<string, string>()
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
        if (key !== HEADER_CHROME_SNAPSHOT_STORAGE_KEY) return null
        return input.raw
      },
    },
    JSON,
  }
  runInNewContext(HEADER_CHROME_BOOT_SCRIPT, context)
  return { classes, props }
}
