import {
  resolveAdminOrderDisplayStatus,
  type AdminOrderFulfillmentInput,
} from "@/lib/admin/admin-order-fulfillment-status"
import type { SupportMacroVars } from "@/lib/utils/apply-support-macro-vars"

/** Sample case the editor preview uses — a confirmed order already on a truck. */
export const SUPPORT_MACRO_PREVIEW_ORDER: AdminOrderFulfillmentInput = {
  status: "confirmed",
  fulfillment_method: "shipping",
  delivery_status: "shipped",
}

export function supportMacroVarsFromOrder(args: {
  name?: string | null
  order_ref?: string | null
  tracking?: string | null
  order?: AdminOrderFulfillmentInput | null
}): SupportMacroVars {
  return {
    name: args.name,
    order_ref: args.order_ref,
    tracking: args.tracking,
    order_status: args.order ? resolveAdminOrderDisplayStatus(args.order).label : null,
  }
}

export const SUPPORT_MACRO_PREVIEW_VARS: SupportMacroVars = supportMacroVarsFromOrder({
  name: "Alex",
  order_ref: "RS-1042",
  tracking: "1Z999AA10123456784",
  order: SUPPORT_MACRO_PREVIEW_ORDER,
})
