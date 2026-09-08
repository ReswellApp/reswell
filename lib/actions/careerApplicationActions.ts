"use server"

import { revalidatePath } from "next/cache"
import { updateCareerApplicationStatusService } from "@/lib/services/careerApplications"
import { careerApplicationStatusUpdateSchema } from "@/lib/validations/careerApplication"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}) {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

export async function updateCareerApplicationStatusAction(raw: unknown) {
  const parsed = careerApplicationStatusUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: flattenZod(parsed.error) }
  const result = await updateCareerApplicationStatusService(parsed.data.id, parsed.data.status)
  if ("success" in result) {
    revalidatePath("/admin/careers")
    revalidatePath(`/admin/careers/${parsed.data.id}`)
  }
  return result
}
