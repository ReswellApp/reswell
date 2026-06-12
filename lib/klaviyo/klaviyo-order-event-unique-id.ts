export function klaviyoOrderEventUniqueId(
  base: string,
  orderId: string,
  resendKey?: string,
): string {
  const suffix = resendKey?.trim()
  return suffix ? `${base}-${orderId}-${suffix}` : `${base}-${orderId}`
}
