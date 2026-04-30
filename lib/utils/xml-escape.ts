/**
 * Escape text for XML element / attribute character data.
 * Required for `<loc>` when URLs contain `?a=1&b=2` — raw `&` is an invalid entity.
 * @see https://www.w3.org/TR/xml/#syntax
 */
export function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
