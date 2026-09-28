import { NextRequest, NextResponse } from "next/server"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { listEmailStudioPreviewEventsService } from "@/lib/services/emailStudio"
import { emailStudioPreviewQuerySchema } from "@/lib/validations/emailStudio"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) return gate.response

  const parsed = emailStudioPreviewQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email project" }, { status: 400 })
  }

  const result = await listEmailStudioPreviewEventsService(parsed.data.projectId)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ data: result }, { status: 200 })
}
