import { timingSafeEqual } from "node:crypto"

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function isCronRequestAuthorized(request: Request, configuredSecret: string | undefined): boolean {
  const secret = configuredSecret?.trim() ?? ""
  if (!secret) return false

  const authorization = request.headers.get("authorization") ?? ""
  if (!authorization.startsWith("Bearer ")) return false

  const token = authorization.slice("Bearer ".length).trim()
  return token.length > 0 && timingSafeEqualText(token, secret)
}
