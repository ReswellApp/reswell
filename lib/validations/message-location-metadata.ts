import { z } from "zod"

export const messageLocationMetadataSchema = z.object({
  kind: z.literal("location_share"),
  formattedAddress: z.string().min(1).max(500),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  placeId: z.string().min(1).max(256).optional(),
})

export type MessageLocationPayload = z.infer<typeof messageLocationMetadataSchema>

export function parseMessageLocationMetadata(metadata: unknown): MessageLocationPayload | null {
  const r = messageLocationMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}

export function composeLocationShareMessageBody(formattedAddress: string): string {
  const t = formattedAddress.trim()
  return `📍 ${t || "Shared a location"}`
}
