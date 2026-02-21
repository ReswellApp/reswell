import { NextRequest, NextResponse } from "next/server"

const LIBRE_URL = "https://libretranslate.com/translate"
const MYMEMORY_URL = "https://api.mymemory.translated.net/get"
const MAX_LENGTH = 5000
const MYMEMORY_MAX_CHARS = 400

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const target = typeof body.target === "string" ? body.target.toLowerCase() : "en"

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    if (text.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_LENGTH} characters)` },
        { status: 400 }
      )
    }

    const targetLang = target === "en" ? "en" : target
    const apiKey = process.env.LIBRETRANSLATE_API_KEY

    // Try LibreTranslate first (JSON)
    let res = await fetch(LIBRE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: targetLang,
        format: "text",
        ...(apiKey && { api_key: apiKey }),
      }),
    })

    // If JSON fails, try form-urlencoded (some instances expect it)
    if (!res.ok && res.status >= 400) {
      const form = new URLSearchParams()
      form.set("q", text)
      form.set("source", "auto")
      form.set("target", targetLang)
      form.set("format", "text")
      if (apiKey) form.set("api_key", apiKey)
      res = await fetch(LIBRE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      })
    }

    if (res.ok) {
      const data = await res.json()
      const translated =
        typeof data.translatedText === "string" ? data.translatedText : ""
      if (translated) {
        return NextResponse.json({ translated })
      }
    } else {
      console.warn("LibreTranslate error:", res.status, await res.text())
    }

    // Fallback: MyMemory (no key; no auto-detect, so we try French→English for common listings)
    const toTranslate =
      text.length > MYMEMORY_MAX_CHARS
        ? text.slice(0, MYMEMORY_MAX_CHARS) + "…"
        : text
    const langpairs = ["fr|en", "es|en", "de|en", "it|en", "pt|en"]
    let translated = ""
    for (const langpair of langpairs) {
      const myRes = await fetch(
        `${MYMEMORY_URL}?q=${encodeURIComponent(toTranslate)}&langpair=${langpair}`,
        { method: "GET" }
      )
      if (myRes.ok) {
        const data = await myRes.json()
        const t = data.responseData?.translatedText ?? ""
        if (t && t !== toTranslate) {
          translated = t
          break
        }
      }
    }

    if (translated) {
      return NextResponse.json({
        translated,
        ...(text.length > MYMEMORY_MAX_CHARS && {
          note: "Translation truncated for length",
        }),
      })
    }

    return NextResponse.json(
      { error: "Translation failed. Try again later or add LIBRETRANSLATE_API_KEY for reliable translation." },
      { status: 502 }
    )
  } catch (e) {
    console.error("Translate API error:", e)
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    )
  }
}
