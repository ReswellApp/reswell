import Anthropic, { APIError, AuthenticationError } from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { FIN_SETUP_LABELS, parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"
import { parseTailShapeFromStorage, TAIL_SHAPE_LABELS } from "@/lib/listing-tail-shape-tags"

/** Strips surrounding quotes and whitespace — common .env mistakes cause invalid x-api-key. */
function normalizeAnthropicApiKey(raw: string): string {
  let k = raw.trim()
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim()
  }
  return k
}

const ANTHROPIC_KEY_REJECTED =
  "Anthropic rejected your API key (invalid x-api-key). In .env.local use ANTHROPIC_API_KEY=sk-ant-... on a single line with no quotes or spaces. Copy the key again from https://console.anthropic.com/settings/keys , save, then restart the dev server. If it still fails, generate a new key — the old one may be revoked or incomplete."

function userFacingAnthropicError(err: unknown): string {
  if (err instanceof AuthenticationError) {
    return ANTHROPIC_KEY_REJECTED
  }
  if (err instanceof APIError && err.status === 401) {
    return ANTHROPIC_KEY_REJECTED
  }
  if (err instanceof APIError) {
    return err.message.length < 280
      ? err.message
      : "Claude request failed. Check your Anthropic account and try again."
  }
  return err instanceof Error ? err.message : "Generation failed"
}

export async function POST(req: Request) {
  const apiKey = normalizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY ?? "")
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI descriptions are not configured. Add ANTHROPIC_API_KEY to .env.local (local) or your host’s environment variables, then restart the dev server. Create a key at https://console.anthropic.com/settings/keys",
      },
      { status: 503 },
    )
  }

  const client = new Anthropic({ apiKey })

  const { listingData } = await req.json()

  const {
    brand,
    model,
    condition,
    length,
    width,
    thickness,
    volume,
    fins,
    tail,
    price,
    location,
  } = listingData

  const conditionLabels: Record<string, string> = {
    new: "New (never used)",
    like_new: "Excellent",
    good: "Good",
    fair: "Fair",
  }

  const dimsLine = [length, width, thickness].filter(Boolean).join(" x ")
  const volLine = volume ? `${volume}L` : null
  const dimsDisplay = [dimsLine, volLine].filter(Boolean).join(" — ")

  let finsDisplay = "Not specified"
  if (Array.isArray(fins) && fins.length > 0) {
    const flat = fins.flatMap((f) => (typeof f === "string" ? parseFinsSetupFromStorage(f) : []))
    const uniq = [...new Set(flat)]
    if (uniq.length) finsDisplay = uniq.map((slug) => FIN_SETUP_LABELS[slug]).join(", ")
  } else if (typeof fins === "string" && fins.trim()) {
    const slugs = parseFinsSetupFromStorage(fins)
    if (slugs.length) finsDisplay = slugs.map((s) => FIN_SETUP_LABELS[s]).join(", ")
  }

  let tailDisplay = "Not specified"
  if (Array.isArray(tail) && tail.length > 0) {
    const flat = tail.flatMap((t) => (typeof t === "string" ? parseTailShapeFromStorage(t) : []))
    const uniq = [...new Set(flat)]
    if (uniq.length) tailDisplay = uniq.map((slug) => TAIL_SHAPE_LABELS[slug]).join(", ")
  } else if (typeof tail === "string" && tail.trim()) {
    const slugs = parseTailShapeFromStorage(tail)
    if (slugs.length) tailDisplay = slugs.map((s) => TAIL_SHAPE_LABELS[s]).join(", ")
  }

  const prompt = `You are helping a surfer write a listing description for their surfboard on Reswell, a peer-to-peer surf gear marketplace. Write a natural, honest, and appealing listing description based on these details:

Board: ${[brand, model].filter(Boolean).join(" ") || "Surfboard"}
Dimensions: ${dimsDisplay || "Not specified"}
Condition: ${conditionLabels[condition] || condition || "Not specified"}
Fins: ${finsDisplay}
Tail: ${tailDisplay}
Price: ${price ? `$${price}` : "Not specified"}
Location: ${location || "Not specified"}

Write 3-4 sentences. Sound like a real surfer, not a salesperson. Mention the dims, condition honestly, what type of surfer or waves it suits, and anything a buyer would want to know. Do not use exclamation marks or hype language. Keep it natural and conversational. Do not include a title — just the description body.`

  let stream: Awaited<ReturnType<Anthropic["messages"]["stream"]>>
  try {
    stream = await client.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (err) {
    const status = err instanceof APIError ? err.status : 502
    return NextResponse.json(
      { error: userFacingAnthropicError(err) },
      { status: status === 401 ? 401 : 502 },
    )
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`,
              ),
            )
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (err) {
        const msg = userFacingAnthropicError(err)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        )
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
