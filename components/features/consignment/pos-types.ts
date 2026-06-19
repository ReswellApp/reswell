/** Client-facing POS types (kept separate so client components never import server-only db modules). */

export type StoreInventoryItem = {
  listingId: string
  title: string
  price: number
  floorPrice: number | null
  coverUrl: string | null
  barcode: string | null
}

export type TerminalReaderRef = {
  id: string
  label: string
  status: string | null
  deviceType: string
  serialNumber: string | null
}
