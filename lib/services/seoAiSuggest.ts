import Anthropic, { APIError } from "@anthropic-ai/sdk"

/** Recommended search-snippet character ranges (kept in sync with the panel's scoring bands). */
const TITLE_RANGE = { min: 30, max: 60 }
const DESCRIPTION_RANGE = { min: 70, max: 160 }

/** Strips surrounding quotes/whitespace — common .env mistakes cause an invalid x-api-key. */
function normalizeAnthropicApiKey(raw: string): string {
  let k = raw.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k
}

export interface SeoSuggestInput {
  label: string
  path: string
  currentTitle: string
  currentDescription: string
  keywords?: string[]
}

export interface SeoSuggestion {
  title: string
  description: string
}

export type SeoSuggestResult =
  | { ok: true; suggestion: SeoSuggestion }
  | { ok: false; error: string; status: number }

const BRAND = "Reswell"

function buildPrompt(input: SeoSuggestInput): string {
  const ctx = [
    `Page: ${input.label}`,
    `Path: ${input.path}`,
    input.currentTitle ? `Current title: ${input.currentTitle}` : null,
    input.currentDescription ? `Current description: ${input.currentDescription}` : null,
    input.keywords?.length ? `Target keywords: ${input.keywords.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  return `You are an SEO expert writing search metadata for ${BRAND}, a peer-to-peer marketplace for buying and selling surfboards and surf gear.

Context for the page you're optimizing:
${ctx}

Write an SEO title and meta description for this page. Rules:
- Title: ${TITLE_RANGE.min}-${TITLE_RANGE.max} characters, compelling and keyword-rich, end with " | ${BRAND}" unless the brand already fits naturally.
- Description: ${DESCRIPTION_RANGE.min}-${DESCRIPTION_RANGE.max} characters, active voice, describe the value of the page and include a soft call to action.
- Match real surfer search intent. No clickbait, no exclamation marks, no emojis.
- Do not exceed the character limits.

Respond with ONLY a JSON object on a single line, no markdown, no commentary:
{"title": "...", "description": "..."}`
}

/** Generate an SEO title + description suggestion for a page. Graceful when AI is unconfigured. */
export async function suggestPageSeo(input: SeoSuggestInput): Promise<SeoSuggestResult> {
  const apiKey = normalizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY ?? "")
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "AI suggestions are not configured. Add ANTHROPIC_API_KEY to your environment.",
    }
  }

  const client = new Anthropic({ apiKey })
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(input) }],
    })

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    const parsed = parseSuggestion(text)
    if (!parsed) {
      return { ok: false, status: 502, error: "Could not parse the AI response. Try again." }
    }
    return { ok: true, suggestion: parsed }
  } catch (err) {
    const status = err instanceof APIError ? (err.status ?? 502) : 502
    const error =
      err instanceof APIError && err.message.length < 280
        ? err.message
        : "AI request failed. Check your Anthropic account and try again."
    return { ok: false, status: status === 401 ? 401 : 502, error }
  }
}

function parseSuggestion(text: string): SeoSuggestion | null {
  // The model may wrap JSON in prose or code fences; extract the first JSON object.
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0]) as { title?: unknown; description?: unknown }
    const title = typeof obj.title === "string" ? obj.title.trim() : ""
    const description = typeof obj.description === "string" ? obj.description.trim() : ""
    if (!title && !description) return null
    return { title, description }
  } catch {
    return null
  }
}
