import type { User } from "@supabase/supabase-js"
import { z } from "zod"
import { SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES } from "@/lib/auth/has-supabase-auth-cookies"
import type { HeaderShopAccess } from "@/lib/auth/header-site-bootstrap"

/** localStorage key. Display-only — never a session token. */
export const HEADER_CHROME_SNAPSHOT_STORAGE_KEY = "rw-header-chrome"

/**
 * sessionStorage latch set the moment sign-out starts. The next document's
 * boot script sees it, drops the remembered account, and moves the signal onto
 * `window` so React will not paint that account. sessionStorage is cleared so
 * the following full load can sign in again.
 */
export const HEADER_CHROME_SIGNED_OUT_STORAGE_KEY = "rw-header-signed-out"

/** Set on `window` by the boot script. Dies with the document, unlike sessionStorage. */
export const HEADER_CHROME_SIGNED_OUT_WINDOW_KEY = "__rwHeaderSignedOut"

/** Set by the boot script when a returning account or auth cookie is recognized. */
export const HEADER_CHROME_KNOWN_CLASS = "rw-known-auth"

/** Set after React has painted the real account cluster (or confirmed a guest). */
export const HEADER_CHROME_HYDRATED_CLASS = "rw-auth-hydrated"

export const HEADER_CHROME_AVATAR_CLASS = "rw-header-has-avatar"
export const HEADER_CHROME_INITIAL_CLASS = "rw-header-has-initial"

const AVATAR_URL_MAX = 2000

/** CSS `url("...")` value, or null when the string could break out of the declaration. */
export function headerChromeAvatarCssValue(url: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > AVATAR_URL_MAX) return null
  if (!/^https:\/\/[^\\"'()\s]+$/.test(trimmed) && !/^\/[^\\"'()\s]+$/.test(trimmed)) {
    return null
  }
  return `url("${trimmed}")`
}

const headerShopAccessSnapshotSchema = z.object({
  actorUserId: z.string().min(1).max(128),
  activeAccountId: z.string().min(1).max(128),
  actingAsShop: z.boolean(),
  shopLabel: z.string().min(1).max(120),
  role: z.enum(["owner", "manager", "staff"]),
  actorEmail: z.string().max(320).nullable(),
  showEarnings: z.boolean(),
  hasShopifyAccess: z.boolean(),
  options: z
    .array(
      z.object({
        accountId: z.string().min(1).max(128),
        label: z.string().min(1).max(120),
        role: z.enum(["owner", "manager", "staff"]),
        shopifyConnectEnabled: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(40),
})

const headerChromeSnapshotSchema = z.object({
  v: z.literal(1),
  userId: z.string().min(1).max(128),
  email: z.string().max(320).nullable(),
  displayName: z.string().max(80).nullable(),
  avatarUrl: z
    .string()
    .max(AVATAR_URL_MAX)
    .nullable()
    .transform((value) => {
      if (value == null) return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    })
    .refine((value) => value === null || headerChromeAvatarCssValue(value) !== null),
  isAdmin: z.boolean(),
  isShipper: z.boolean(),
  isDropoffLocation: z.boolean(),
  unreadMessages: z.number().int().nonnegative().max(1_000_000),
  unreadSupport: z.number().int().nonnegative().max(1_000_000),
  walletBalance: z.number().finite().nullable(),
  /** Validated in `parseHeaderChromeSnapshot`. A bad value must not drop the account. */
  shopAccess: z.unknown().optional(),
})

export type HeaderChromeSnapshot = Omit<z.infer<typeof headerChromeSnapshotSchema>, "shopAccess"> & {
  shopAccess?: HeaderShopAccess
}

/**
 * Blocking boot script for the root layout. Cached HTML is anonymous; this
 * reads the last confirmed account snapshot (and a visible auth cookie) and
 * flags `<html>` before the header paints, so returning visitors do not see
 * Log in while `getUser()` is still in flight.
 *
 * A sign-out latch skips that paint, deletes the snapshot, and expires visible
 * auth cookies. It then clears the storage latch and sets a window flag so
 * this document will not paint the account, while the next full load can sign in.
 */
export const HEADER_CHROME_BOOT_SCRIPT = `(function(){try{var root=document.documentElement;var signedOutKey=${JSON.stringify(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY)};var expire=${JSON.stringify(SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES)};var signedOut=false;try{signedOut=sessionStorage.getItem(signedOutKey)==="1";}catch(e){signedOut=false;}if(!signedOut){try{signedOut=document.cookie.split(";").some(function(part){return (part.trim().split("=")[0]||"")===signedOutKey;});}catch(e){signedOut=false;}}if(signedOut){try{localStorage.removeItem(${JSON.stringify(HEADER_CHROME_SNAPSHOT_STORAGE_KEY)});}catch(e){}try{var parts=document.cookie.split(";");for(var i=0;i<parts.length;i++){var cname=(parts[i].trim().split("=")[0]||"");if(cname.indexOf("sb-")===0&&cname.indexOf("auth-token")!==-1){document.cookie=cname+"=; "+expire;try{if(location.protocol==="https:")document.cookie=cname+"=; "+expire+"; secure";}catch(e2){}}}}catch(e){}try{document.cookie=signedOutKey+"=; "+expire;}catch(e){}try{sessionStorage.removeItem(signedOutKey);}catch(e){}try{window[${JSON.stringify(HEADER_CHROME_SIGNED_OUT_WINDOW_KEY)}]=1;}catch(e){}return;}var hasAuthCookie=document.cookie.split(";").some(function(part){var name=(part.trim().split("=")[0]||"");var value=part.slice(part.indexOf("=")+1);return name.indexOf("sb-")===0&&name.indexOf("auth-token")!==-1&&value.length>0;});var raw=null;try{raw=localStorage.getItem(${JSON.stringify(HEADER_CHROME_SNAPSHOT_STORAGE_KEY)});}catch(e){raw=null;}var snap=null;if(raw){try{snap=JSON.parse(raw);}catch(e){snap=null;}}var valid=!!(snap&&snap.v===1&&typeof snap.userId==="string"&&snap.userId.length>0);if(!valid&&!hasAuthCookie)return;root.classList.add(${JSON.stringify(HEADER_CHROME_KNOWN_CLASS)});if(!valid)return;var name=typeof snap.displayName==="string"?snap.displayName.trim():"";var email=typeof snap.email==="string"?snap.email.trim():"";var source=name||email;var initial="";try{var match=source.match(/\\p{L}/u);initial=(match?match[0]:(source.charAt(0)||"")).toUpperCase();}catch(e){initial=(source.charAt(0)||"").toUpperCase();}if(initial){root.classList.add(${JSON.stringify(HEADER_CHROME_INITIAL_CLASS)});root.style.setProperty("--rw-header-initial",JSON.stringify(initial));}var avatar=typeof snap.avatarUrl==="string"?snap.avatarUrl.trim():"";if(avatar.length>0&&avatar.length<=${AVATAR_URL_MAX}&&(/^https:\\/\\/[^\\\\"'()\\s]+$/.test(avatar)||/^\\/[^\\\\"'()\\s]+$/.test(avatar))){root.classList.add(${JSON.stringify(HEADER_CHROME_AVATAR_CLASS)});root.style.setProperty("--rw-header-avatar",'url("'+avatar+'")');}}catch(e){}})();`

/** True on the document that called `markHeaderChromeSignedOut`, until it unloads. */
let signOutLatch = false

/**
 * True after this document has observed a sign-out, even once sessionStorage
 * was cleared for the next full load. A later sign-in clears it.
 */
let signedOutThisDocument = false

function hasHeaderChromeSignOutCookie(): boolean {
  if (typeof document === "undefined") return false
  try {
    return document.cookie.split(";").some((part) => {
      return (part.trim().split("=")[0] ?? "") === HEADER_CHROME_SIGNED_OUT_STORAGE_KEY
    })
  } catch {
    return false
  }
}

/** True on the page that started sign-out. The next document's copy is false. */
export function headerChromeSignOutStartedHere(): boolean {
  return signOutLatch
}

function windowSignedOutFlag(): boolean {
  if (typeof window === "undefined") return false
  const flagged = window as Window & { [HEADER_CHROME_SIGNED_OUT_WINDOW_KEY]?: number }
  return flagged[HEADER_CHROME_SIGNED_OUT_WINDOW_KEY] === 1
}

export function headerChromeSignOutLatched(): boolean {
  if (signOutLatch || signedOutThisDocument) return true
  if (typeof window === "undefined") return false
  if (windowSignedOutFlag()) return true
  try {
    if (sessionStorage.getItem(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY) === "1") return true
  } catch {
    // Fall through to the cookie the sign-out redirect sets.
  }
  return hasHeaderChromeSignOutCookie()
}

/**
 * The next document saw the latch and committed the guest header.
 * Drop the storage flag so a later load can sign in, but keep this document
 * from painting the account again until `clearHeaderChromeSignOutLatch`.
 */
function clearHeaderChromeSignedOutWindowFlag(): void {
  if (typeof window === "undefined") return
  const flagged = window as Window & { [HEADER_CHROME_SIGNED_OUT_WINDOW_KEY]?: number }
  delete flagged[HEADER_CHROME_SIGNED_OUT_WINDOW_KEY]
}

export function acknowledgeHeaderChromeSignedOut(): void {
  signedOutThisDocument = true
  signOutLatch = false
  clearHeaderChromeSignedOutWindowFlag()
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY)
  } catch {
    // The in-memory document flag still blocks snapshot paints.
  }
  if (typeof document === "undefined") return
  try {
    document.cookie = `${HEADER_CHROME_SIGNED_OUT_STORAGE_KEY}=; ${SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES}`
  } catch {
    // Cookie cleanup is best-effort; the document flag is what blocks the paint.
  }
}

/** Allow a later sign-in in this tab to remember the account again. */
export function clearHeaderChromeSignOutLatch(): void {
  signOutLatch = false
  signedOutThisDocument = false
  clearHeaderChromeSignedOutWindowFlag()
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY)
  } catch {
    // Storage can throw in private mode; the in-memory latch is already clear.
  }
  if (typeof document === "undefined") return
  try {
    document.cookie = `${HEADER_CHROME_SIGNED_OUT_STORAGE_KEY}=; ${SUPABASE_AUTH_COOKIE_CLEAR_ATTRIBUTES}`
  } catch {
    // A leftover sign-out cookie would keep the next sign-in from painting.
  }
}

/**
 * Call before navigating to `/auth/sign-out`. Blocks snapshot writes on this
 * page and tells the next document not to paint the remembered account.
 */
export function markHeaderChromeSignedOut(): void {
  signOutLatch = true
  signedOutThisDocument = true
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY, "1")
    } catch {
      // The in-memory latch still blocks writes in this document.
    }
  }
  clearHeaderChromeSnapshot()
}

let memory: { raw: string | null; snapshot: HeaderChromeSnapshot | null } | null = null

export function parseHeaderChromeSnapshot(raw: string | null): HeaderChromeSnapshot | null {
  if (!raw) return null
  try {
    const parsed = headerChromeSnapshotSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const { shopAccess: rawShop, ...account } = parsed.data
    const shop = headerShopAccessSnapshotSchema.safeParse(rawShop)
    if (!shop.success || shop.data.actorUserId !== account.userId) return account
    return { ...account, shopAccess: shop.data }
  } catch {
    return null
  }
}

export function readHeaderChromeSnapshot(): HeaderChromeSnapshot | null {
  if (typeof window === "undefined") return null
  let raw: string | null = null
  try {
    raw = localStorage.getItem(HEADER_CHROME_SNAPSHOT_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (memory && memory.raw === raw) return memory.snapshot
  const snapshot = parseHeaderChromeSnapshot(raw)
  memory = { raw, snapshot }
  return snapshot
}

export function writeHeaderChromeSnapshot(input: HeaderChromeSnapshot): void {
  // A profile refetch started before sign-out can resolve afterwards and would
  // put the account back in localStorage for the next page to paint.
  if (headerChromeSignOutLatched()) return
  const parsed = headerChromeSnapshotSchema.safeParse(input)
  if (!parsed.success) return
  if (headerChromeSignOutLatched()) return
  const raw = JSON.stringify(parsed.data)
  const snapshot = parseHeaderChromeSnapshot(raw)
  memory = { raw, snapshot }
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(HEADER_CHROME_SNAPSHOT_STORAGE_KEY, raw)
  } catch {
    // Quota or private mode — the in-memory copy still paints this document.
  }
}

export function clearHeaderChromeSnapshot(): void {
  memory = { raw: null, snapshot: null }
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(HEADER_CHROME_SNAPSHOT_STORAGE_KEY)
  } catch {
    // Ignore storage failures; class cleanup below still reveals guest chrome.
  }
  const root = document.documentElement
  root.classList.remove(
    HEADER_CHROME_KNOWN_CLASS,
    HEADER_CHROME_AVATAR_CLASS,
    HEADER_CHROME_INITIAL_CLASS,
  )
  root.style.removeProperty("--rw-header-avatar")
  root.style.removeProperty("--rw-header-initial")
}

export function markHeaderChromeHydrated(): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.add(HEADER_CHROME_HYDRATED_CLASS)
}

/** Minimal user so the account menu can render before GoTrue responds. */
export function headerChromeSnapshotUser(snapshot: HeaderChromeSnapshot): User {
  return {
    id: snapshot.userId,
    aud: "authenticated",
    role: "authenticated",
    email: snapshot.email ?? undefined,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  }
}
