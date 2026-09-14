/** Coastal shop-sign washes for seller tiles with no photos. Stable per seller id. */
export type SellerDirectorySignature = {
  panelClass: string
  monogramClass: string
}

const SIGNATURES: readonly SellerDirectorySignature[] = [
  { panelClass: "bg-[#1B3A4B]", monogramClass: "text-white/20" },
  { panelClass: "bg-[#3D4F3A]", monogramClass: "text-white/20" },
  { panelClass: "bg-[#4A3A2A]", monogramClass: "text-white/20" },
  { panelClass: "bg-[#2C3E5A]", monogramClass: "text-white/20" },
  { panelClass: "bg-[#5A3A38]", monogramClass: "text-white/20" },
  { panelClass: "bg-[#2F4A4A]", monogramClass: "text-white/20" },
]

const BANNER_STOPWORDS = new Set(["the", "official", "shop", "store", "a", "an", "and"])

export function sellerDirectorySignature(sellerId: string): SellerDirectorySignature {
  let hash = 0
  for (let i = 0; i < sellerId.length; i += 1) {
    hash = (hash * 31 + sellerId.charCodeAt(i)) >>> 0
  }
  return SIGNATURES[hash % SIGNATURES.length]!
}

/** Short shop-sign letters from the seller name. */
export function sellerDirectoryMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const pick =
    words.find((word) => word.length >= 3 && !BANNER_STOPWORDS.has(word.toLowerCase())) ||
    words[0] ||
    "S"
  return pick.slice(0, 4).toUpperCase()
}
