export const SUPPORT_MACRO_VAR_KEYS = [
  "name",
  "order_ref",
  "tracking",
  "order_status",
] as const

export type SupportMacroVarKey = (typeof SUPPORT_MACRO_VAR_KEYS)[number]

export type SupportMacroVars = {
  name?: string | null
  order_ref?: string | null
  tracking?: string | null
  order_status?: string | null
}

export const SUPPORT_MACRO_VAR_FALLBACKS: Record<SupportMacroVarKey, string> = {
  name: "there",
  order_ref: "your order",
  tracking: "your tracking number",
  order_status: "in progress",
}

export const SUPPORT_MACRO_VAR_HINTS: { key: SupportMacroVarKey; token: string; label: string }[] = [
  { key: "name", token: "{{name}}", label: "Name" },
  { key: "order_ref", token: "{{order_ref}}", label: "Order" },
  { key: "tracking", token: "{{tracking}}", label: "Tracking" },
  { key: "order_status", token: "{{order_status}}", label: "Order status" },
]

export function applySupportMacroVars(body: string, vars: SupportMacroVars = {}): string {
  return body
    .replaceAll("{{name}}", vars.name?.trim() || SUPPORT_MACRO_VAR_FALLBACKS.name)
    .replaceAll("{{order_ref}}", vars.order_ref?.trim() || SUPPORT_MACRO_VAR_FALLBACKS.order_ref)
    .replaceAll("{{tracking}}", vars.tracking?.trim() || SUPPORT_MACRO_VAR_FALLBACKS.tracking)
    .replaceAll("{{order_status}}", vars.order_status?.trim() || SUPPORT_MACRO_VAR_FALLBACKS.order_status)
}
