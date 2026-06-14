/**
 * Persists create-listing form + image blobs so mobile Safari/WebKit can recover
 * after the tab is suspended or reloaded when returning from the photo library.
 *
 * Drafts are keyed by authenticated user id (or `guest` for anonymous create flows).
 * Guest snapshots migrate to the signed-in user on auth so login redirects do not wipe progress.
 */

const DB_NAME = "reswell-sell-draft"
const STORE = "draft"
/** Legacy single-slot key (pre–user-scoped drafts) — cleared on DB upgrade. */
const LEGACY_KEY = "current"
/** Anonymous create-listing snapshot — migrated to the signed-in user on auth. */
export const GUEST_DRAFT_KEY = "guest"

const DB_VERSION = 2

export const SELL_LISTING_DRAFT_VERSION = 7

export type SellListingDraftFormSnapshot = Record<string, unknown>

export type SellListingDraftImageBlob = {
  name: string
  type: string
  buffer: ArrayBuffer
}

export type SellListingDraftRecord = {
  v: number
  listingType: "board"
  formData: SellListingDraftFormSnapshot
  imageBlobs: SellListingDraftImageBlob[]
  /** Supabase auth user id — required for new saves; used to reject cross-user loads. */
  userId?: string
  /** Supabase draft row id — keeps /sell on one URL without navigation. */
  serverListingId?: string
}

function userDraftKey(userId: string): string {
  return `u:${userId}`
}

function str(formData: SellListingDraftFormSnapshot, key: string): string {
  const v = formData[key]
  return typeof v === "string" ? v.trim() : ""
}

/**
 * True when the user entered at least one “substantive” listing field worth persisting drafts.
 * Used for IDB snapshots, Save draft / exit-save, and rejecting empty restores.
 *
 * Only title, description, brand (free text or catalog id), model (typed or catalog slug),
 * or externally supplied photos qualify — dimensions, category, pin-only location, etc. do not.
 */
export function sellDraftFormLooksFilled(formData: SellListingDraftFormSnapshot): boolean {
  if (str(formData, "title") || str(formData, "description")) return true
  if (str(formData, "brand")) return true
  if (str(formData, "boardBrandId")) return true
  if (str(formData, "boardBrandModelId")) return true
  if (str(formData, "boardModelName")) return true
  if (str(formData, "boardIndexModelSlug")) return true
  return false
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      } else if (event.oldVersion < 2) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (tx) {
          try {
            tx.objectStore(STORE).delete(LEGACY_KEY)
          } catch {
            /* ignore */
          }
        }
      }
    }
  })
}

export async function loadSellListingDraft(userId: string): Promise<SellListingDraftRecord | null> {
  return loadSellListingDraftByKey(userDraftKey(userId), userId)
}

export async function loadGuestSellListingDraft(): Promise<SellListingDraftRecord | null> {
  return loadSellListingDraftByKey(GUEST_DRAFT_KEY)
}

async function loadSellListingDraftByKey(
  key: string,
  expectedUserId?: string,
): Promise<SellListingDraftRecord | null> {
  try {
    const db = await openDb()
    const record = await new Promise<SellListingDraftRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      tx.onerror = () => reject(tx.error)
      const r = tx.objectStore(STORE).get(key)
      r.onsuccess = () => resolve(r.result as SellListingDraftRecord | undefined)
      r.onerror = () => reject(r.error)
    })
    db.close()
    if (!record || (record.v !== SELL_LISTING_DRAFT_VERSION && record.v !== 6)) return null
    if (expectedUserId && record.userId && record.userId !== expectedUserId) return null
    const blobs = Array.isArray(record.imageBlobs) ? record.imageBlobs : []
    if (blobs.length === 0 && !sellDraftFormLooksFilled(record.formData)) return null
    return { ...record, imageBlobs: blobs }
  } catch {
    return null
  }
}

export async function saveGuestSellListingDraft(record: SellListingDraftRecord): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put(record, GUEST_DRAFT_KEY)
    })
    db.close()
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn("[sell draft] guest storage quota exceeded")
      return
    }
    console.warn("[sell draft] guest save failed", e)
  }
}

export async function saveSellListingDraft(record: SellListingDraftRecord): Promise<void> {
  const uid = record.userId?.trim()
  if (!uid) {
    console.warn("[sell draft] save skipped — missing userId")
    return
  }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put(record, userDraftKey(uid))
    })
    db.close()
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn("[sell draft] storage quota exceeded")
      return
    }
    console.warn("[sell draft] save failed", e)
  }
}

export async function buildSellListingDraft(
  listingType: "board",
  formData: SellListingDraftFormSnapshot,
  images: { file?: File }[],
  serverListingId?: string | null,
  userId?: string | null,
  options?: { allowGuest?: boolean },
): Promise<SellListingDraftRecord | null> {
  const imageBlobs: SellListingDraftImageBlob[] = []
  for (const im of images) {
    if (!im.file) continue
    const buffer = await im.file.arrayBuffer()
    imageBlobs.push({
      name: im.file.name,
      type: im.file.type || "image/jpeg",
      buffer,
    })
  }
  const formSnapshot = JSON.parse(JSON.stringify(formData)) as SellListingDraftFormSnapshot
  if (imageBlobs.length === 0 && !sellDraftFormLooksFilled(formSnapshot)) return null
  const sid =
    typeof serverListingId === "string" && /^[0-9a-f-]{36}$/i.test(serverListingId)
      ? serverListingId
      : undefined
  const uid = typeof userId === "string" && userId.trim() ? userId.trim() : undefined
  if (!uid && !options?.allowGuest) return null
  return {
    v: SELL_LISTING_DRAFT_VERSION,
    listingType,
    formData: formSnapshot,
    imageBlobs,
    ...(uid ? { userId: uid } : {}),
    ...(sid ? { serverListingId: sid } : {}),
  }
}

/**
 * Moves a guest snapshot onto the signed-in user key so a full-page login redirect can restore it.
 * Returns true when a guest draft existed and was migrated.
 */
export async function migrateGuestSellListingDraftToUser(userId: string): Promise<boolean> {
  const uid = userId.trim()
  if (!uid) return false
  const guest = await loadGuestSellListingDraft()
  if (!guest) return false
  const migrated: SellListingDraftRecord = { ...guest, userId: uid }
  await saveSellListingDraft(migrated)
  await clearGuestSellListingDraft()
  return true
}

export async function clearGuestSellListingDraft(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(GUEST_DRAFT_KEY)
    })
    db.close()
  } catch {
    /* ignore */
  }
}

export async function clearSellListingDraft(userId: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(userDraftKey(userId))
    })
    db.close()
  } catch {
    /* ignore */
  }
}
