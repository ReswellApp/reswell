import Anthropic, { APIError, AuthenticationError } from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatCondition } from "@/lib/listing-labels"

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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to generate descriptions." }, { status: 401 })
  }

  const apiKey = normalizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY ?? "")
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI descriptions are not configured. Add ANTHROPIC_API_KEY to .env.local (local) or your host's environment variables, then restart the dev server. Create a key at https://console.anthropic.com/settings/keys",
      },
      { status: 503 },
    )
  }

  const client = new Anthropic({ apiKey })

  const { listingData } = await req.json()

  const {
    title,
    brand,
    model,
    category,
    boardType,
    condition,
    length,
    width,
    thickness,
    volume,
    price,
    location,
  } = listingData

  const boardName = [brand, model].filter(Boolean).join(" ") || title || "Surfboard"
  const boardShape = [category, boardType].filter(Boolean).join(" / ") || null

  const dimParts = [
    length ? `${length}` : null,
    width ? `${width}"` : null,
    thickness ? `${thickness}"` : null,
    volume ? `${volume}L` : null,
  ].filter(Boolean)
  const dimsDisplay = dimParts.length ? dimParts.join(" x ") : null

  const lines: string[] = [
    `Board: ${boardName}`,
    boardShape ? `Shape/category: ${boardShape}` : null,
    dimsDisplay ? `Dimensions: ${dimsDisplay}` : null,
    `Condition: ${formatCondition(condition) || "Not specified"}`,
    price ? `Asking price: $${price}` : null,
    location ? `Location: ${location}` : null,
  ].filter((l): l is string => Boolean(l))

  const prompt = `You are helping a surfer write a listing description for their surfboard on Reswell, a peer-to-peer surf gear marketplace.

Here are the details for the listing:

${lines.join("\n")}

Write a short, honest, and natural listing description — 3 to 4 sentences maximum. Guidelines:
- Write in first person, as if the seller is speaking directly to a buyer.
- Use the listing details above to inform what you write. Mention the dimensions, condition, and anything relevant about who the board suits or what waves it works for.
- Do NOT use dashes (hyphens used as punctuation, like " — " or " - "). Use plain sentences instead.
- Do NOT use exclamation marks or hype language.
- Do NOT include a title or heading — just the description body.
- Sound like a real surfer, not a salesperson. Keep it conversational and genuine.`

  let stream: Awaited<ReturnType<Anthropic["messages"]["stream"]>>
  try {
    stream = await client.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 350,
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
