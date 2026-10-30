/** ShipEngine PNG downloads often share the PDF path with a .png suffix. */
export function pngUrlFromPdfUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!/\.pdf$/i.test(parsed.pathname)) return null
    parsed.pathname = parsed.pathname.replace(/\.pdf$/i, ".png")
    return parsed.toString()
  } catch {
    return null
  }
}
