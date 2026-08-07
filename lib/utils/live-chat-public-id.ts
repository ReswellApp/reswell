/** Anonymous-facing session id, e.g. `lc_a1b2c3d4e5f67890`. */
export function generateLiveChatPublicId(): string {
  const hex = crypto.randomUUID().replace(/-/g, "")
  return `lc_${hex.slice(0, 16)}`
}
