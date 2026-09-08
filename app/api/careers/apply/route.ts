import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { submitCareerApplicationService } from "@/lib/services/careerApplications"
import { careerApplicationSubmitSchema } from "@/lib/validations/careerApplication"

export const dynamic = "force-dynamic"

function flattenZod(error: {
  flatten: () => { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> }
}) {
  const flat = error.flatten()
  const firstField = Object.values(flat.fieldErrors).find((msgs) => msgs && msgs.length > 0)
  return firstField?.[0] ?? flat.formErrors[0] ?? "Check the form and try again."
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const parsed = careerApplicationSubmitSchema.safeParse({
    roleSlug: form.get("roleSlug"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    surfingNote: form.get("surfingNote"),
    favoriteBoard: form.get("favoriteBoard"),
    company: form.get("company"),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: flattenZod(parsed.error) }, { status: 400 })
  }

  const resumeValue = form.get("resume")
  const resume = resumeValue instanceof File && resumeValue.size > 0 ? resumeValue : null

  try {
    const result = await submitCareerApplicationService(parsed.data, resume)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    revalidatePath("/admin/careers")
    return NextResponse.json({ data: result.data }, { status: 200 })
  } catch (error) {
    console.error("POST /api/careers/apply:", error)
    return NextResponse.json({ error: "Could not submit your application" }, { status: 500 })
  }
}
