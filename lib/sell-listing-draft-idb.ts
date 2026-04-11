/**
 * Persists create-listing form + image blobs so mobile Safari/WebKit can recover
 * after the tab is suspended or reloaded when returning from the photo library.
 */

const DB_NAME = "reswell-sell-draft"
const STORE = "draft"
const KEY = "current"
export const SELL_LISTING_DRAFT_VERSION = 5

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
}

export function sellDraftFormLooksFilled(formData: SellListingDraftFormSnapshot): boolean {
  const title = typeof formData.title === "string" ? formData.title.trim() : ""
  const price = typeof formData.price === "string" ? formData.price.trim() : ""
  const description = typeof formData.description === "string" ? formData.description.trim() : ""
  return !!(title || price || description)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

export async function loadSellListingDraft(): Promise<SellListingDraftRecord | null> {
  try {
    const db = await openDb()
    const record = await new Promise<SellListingDraftRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      tx.onerror = () => reject(tx.error)
      const r = tx.objectStore(STORE).get(KEY)
      r.onsuccess = () => resolve(r.result as SellListingDraftRecord | undefined)
      r.onerror = () => reject(r.error)
    })
    db.close()
    if (!record || record.v !== SELL_LISTING_DRAFT_VERSION) return null
    const blobs = Array.isArray(record.imageBlobs) ? record.imageBlobs : []
    if (blobs.length === 0 && !sellDraftFormLooksFilled(record.formData)) return null
    return { ...record, imageBlobs: blobs }
  } catch {
    return null
  }
}

export async function saveSellListingDraft(record: SellListingDraftRecord): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).put(record, KEY)
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
  return {
    v: SELL_LISTING_DRAFT_VERSION,
    listingType,
    formData: formSnapshot,
    imageBlobs,
  }
}

export async function clearSellListingDraft(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(KEY)
    })
    db.close()
  } catch {
    /* ignore */
  }
}
