import { sellShareImageResponse, SELL_OG_SIZE } from "@/lib/og/sell-share-image"

export const size = SELL_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return sellShareImageResponse()
}
