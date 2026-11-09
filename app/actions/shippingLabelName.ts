"use server"

import {
  saveShippingLabelName,
  type SaveShippingLabelNameResult,
} from "@/lib/services/shippingLabelName"

export async function updateShippingLabelNameAction(
  input: unknown,
): Promise<SaveShippingLabelNameResult> {
  return saveShippingLabelName(input)
}
