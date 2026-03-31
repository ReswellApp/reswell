import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(req: Request) {
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
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
  }

  const finsLabels: Record<string, string> = {
    single: "Single fin",
    twin: "Twin (2+1)",
    thruster: "Thruster",
    quad: "Quad",
    five: "5-fin",
    other: "Other",
  }

  const tailLabels: Record<string, string> = {
    round: "Round tail",
    squash: "Squash tail",
    square: "Square tail",
    pin: "Pin tail",
    swallow: "Swallow tail",
    fish: "Fish tail",
  }

  const dimsLine = [length, width, thickness].filter(Boolean).join(" x ")
  const volLine = volume ? `${volume}L` : null
  const dimsDisplay = [dimsLine, volLine].filter(Boolean).join(" — ")

  const prompt = `You are helping a surfer write a listing description for their surfboard on Reswell, a peer-to-peer surf gear marketplace. Write a natural, honest, and appealing listing description based on these details:

Board: ${[brand, model].filter(Boolean).join(" ") || "Surfboard"}
Dimensions: ${dimsDisplay || "Not specified"}
Condition: ${conditionLabels[condition] || condition || "Not specified"}
Fins: ${finsLabels[fins] || fins || "Not specified"}
Tail: ${tailLabels[tail] || tail || "Not specified"}
Price: ${price ? `$${price}` : "Not specified"}
Location: ${location || "Not specified"}

Write 3-4 sentences. Sound like a real surfer, not a salesperson. Mention the dims, condition honestly, what type of surfer or waves it suits, and anything a buyer would want to know. Do not use exclamation marks or hype language. Keep it natural and conversational. Do not include a title — just the description body.`

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  })

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
        const msg = err instanceof Error ? err.message : "Generation failed"
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
