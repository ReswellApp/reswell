import { z } from "zod"

const alignSchema = z.enum(["left", "center"])
const idSchema = z.string().uuid()
const shortText = z.string().max(500)
const bodyText = z.string().max(8000)
const hrefText = z.string().max(2000)

const detailRowSchema = z.object({
  id: idSchema,
  label: shortText,
  value: z.string().max(2000),
})

const blockSchema = z.discriminatedUnion("type", [
  z.object({
    id: idSchema,
    type: z.literal("logo"),
    src: hrefText,
    alt: shortText,
    href: hrefText,
    width: z.number().int().min(80).max(220),
  }),
  z.object({
    id: idSchema,
    type: z.literal("eyebrow"),
    text: shortText,
    align: alignSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("heading"),
    text: shortText,
    align: alignSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("text"),
    text: bodyText,
    align: alignSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("image"),
    src: hrefText,
    alt: shortText,
    href: hrefText,
    width: z.number().int().min(40).max(560).optional(),
    height: z.number().int().min(40).max(800).nullable().optional(),
  }),
  z.object({
    id: idSchema,
    type: z.literal("button"),
    label: shortText,
    href: hrefText,
    align: alignSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("split"),
    imageSrc: hrefText,
    imageAlt: shortText,
    imageHref: hrefText,
    imageWidth: z.number().int().min(40).max(280).optional(),
    imageHeight: z.number().int().min(40).max(800).nullable().optional(),
    title: shortText,
    text: bodyText,
    buttonLabel: shortText,
    buttonHref: hrefText,
  }),
  z.object({
    id: idSchema,
    type: z.literal("details"),
    title: shortText,
    rows: z.array(detailRowSchema).max(12),
  }),
  z.object({ id: idSchema, type: z.literal("divider") }),
  z.object({
    id: idSchema,
    type: z.literal("spacer"),
    height: z.number().int().min(8).max(80),
  }),
  z.object({
    id: idSchema,
    type: z.literal("footer"),
    text: bodyText,
    showUnsubscribe: z.boolean(),
  }),
])

export const emailStudioDocumentSchema = z.object({
  blocks: z.array(blockSchema).max(40),
  htmlOverride: z.string().max(500_000).nullable().optional(),
})

const metaSchema = z.object({
  name: z.string().trim().min(1, "Name the project").max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  flowName: z.string().max(200),
  flowId: z.string().max(80),
  triggerMetric: z.string().max(120),
  notes: z.string().max(2000),
  document: emailStudioDocumentSchema,
})

export const createEmailStudioSchema = z.object({
  name: z.string().trim().min(1, "Name the project").max(120),
  kind: z.enum(["project", "template"]).default("project"),
  starterId: z.string().max(40).optional(),
  templateId: z.string().uuid().optional(),
})

export const updateEmailStudioSchema = metaSchema.extend({
  id: z.string().uuid(),
})

export const emailStudioIdSchema = z.object({
  id: z.string().uuid(),
})

export const saveEmailStudioTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
})

export type CreateEmailStudioInput = z.infer<typeof createEmailStudioSchema>
export type UpdateEmailStudioInput = z.infer<typeof updateEmailStudioSchema>
