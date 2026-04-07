import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"

const MAX_LOGO_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function extForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  return null
}

function parseAbout(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function trimField(s: unknown, max: number): string | null {
  const t = typeof s === "string" ? s.trim() : ""
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Sign in to submit a brand request." }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const name = trimField(form.get("name"), 200)
  if (!name) {
    return NextResponse.json({ error: "Enter a brand name." }, { status: 400 })
  }

  let website = trimField(form.get("websiteUrl"), 500)
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`
  }

  const shortDescription = trimField(form.get("shortDescription"), 2000)
  const founderName = trimField(form.get("founderName"), 200)
  const leadShaperName = trimField(form.get("leadShaperName"), 200)
  const locationLabel = trimField(form.get("locationLabel"), 200)
  const aboutParagraphs = parseAbout(typeof form.get("about") === "string" ? (form.get("about") as string) : "")
  for (const p of aboutParagraphs) {
    if (p.length > 4000) {
      return NextResponse.json({ error: "Each about paragraph is too long." }, { status: 400 })
    }
  }

  const file = form.get("logo")
  let logoUrl: string | null = null
  let uploadedPath: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be 5 MB or smaller." }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Logo must be JPEG, PNG, WebP, or GIF." }, { status: 400 })
    }
    const ext = extForMime(file.type)
    if (!ext) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 })
    }
    uploadedPath = `${user.id}/${randomUUID()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage.from("brand-request-logos").upload(uploadedPath, bytes, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) {
      console.error("[brand-requests] storage upload:", uploadError.message)
      return NextResponse.json({ error: "Could not upload logo. Try again." }, { status: 500 })
    }
    logoUrl = supabase.storage.from("brand-request-logos").getPublicUrl(uploadedPath).data.publicUrl
  }

  const { error: insertError } = await supabase.from("brand_requests").insert({
    user_id: user.id,
    requested_name: name,
    website_url: website,
    short_description: shortDescription,
    founder_name: founderName,
    lead_shaper_name: leadShaperName,
    location_label: locationLabel,
    about_paragraphs: aboutParagraphs.length ? aboutParagraphs : [],
    logo_url: logoUrl,
    status: "pending",
    notes: null,
  })

  if (insertError) {
    console.error("[brand-requests] insert:", insertError.message)
    if (uploadedPath) {
      await supabase.storage.from("brand-request-logos").remove([uploadedPath])
    }
    return NextResponse.json({ error: "Could not save your request. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
