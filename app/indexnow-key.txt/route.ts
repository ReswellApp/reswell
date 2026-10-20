import { readIndexNowKey } from "@/lib/seo/indexnow"

/** Public IndexNow key file. Bing fetches this to verify url submissions. */
export function GET() {
  const key = readIndexNowKey(process.env.INDEXNOW_KEY)
  if (!key) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    })
  }

  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
