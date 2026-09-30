import { z } from "zod"

const alignSchema = z.enum(["left", "center"])
const idSchema = z.string().uuid()
const shortText = z.string().max(500)
const bodyText = z.string().max(8000)
const hrefText = z.string().max(2000)
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const hideOnSchema = z.enum(["desktop", "mobile"])
const fontWeightSchema = z.enum(["normal", "bold"])
const textStyleSchema = {
  color: hexColor.optional(),
  fontSize: z.number().int().min(10).max(64).optional(),
  fontWeight: fontWeightSchema.optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  hideOn: hideOnSchema.optional(),
}
const paddingSchema = z.object({
  top: z.number().int().min(0).max(120),
  right: z.number().int().min(0).max(120),
  bottom: z.number().int().min(0).max(120),
  left: z.number().int().min(0).max(120),
})

const detailRowSchema = z.object({
  id: idSchema,
  label: shortText,
  value: z.string().max(2000),
})

const emailStudioProductSnapshotSchema = z.object({
  id: idSchema,
  title: shortText,
  priceDisplay: shortText,
  condition: shortText,
  dimensions: shortText,
  boardType: shortText,
  imageUrl: hrefText,
  productUrl: hrefText,
  availability: z.enum(["available", "pending", "sold", "unavailable"]),
})

export const emailProductBlockSchema = z.object({
  id: idSchema,
  type: z.literal("product"),
  title: shortText,
  listingIds: z.array(idSchema).max(4),
  items: z.array(emailStudioProductSnapshotSchema).max(4),
  showPrice: z.boolean(),
  showCondition: z.boolean(),
  showDimensions: z.boolean(),
  showBoardType: z.boolean(),
  showAvailability: z.boolean(),
  ctaLabel: shortText,
})

export const emailContentBlockSchema = z.discriminatedUnion("type", [
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
    ...textStyleSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("heading"),
    text: shortText,
    align: alignSchema,
    ...textStyleSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("text"),
    text: bodyText,
    align: alignSchema,
    ...textStyleSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("image"),
    src: hrefText,
    alt: shortText,
    href: hrefText,
    width: z.number().int().min(40).max(560).optional(),
    height: z.number().int().min(40).max(800).nullable().optional(),
    radius: z.number().int().min(0).max(40).optional(),
    padding: paddingSchema.optional(),
    hideOn: hideOnSchema.optional(),
  }),
  z.object({
    id: idSchema,
    type: z.literal("button"),
    label: shortText,
    href: hrefText,
    align: alignSchema,
    fullWidth: z.boolean().optional(),
    fontFamily: z.enum(["sans", "headline"]).optional(),
    fontWeight: fontWeightSchema.optional(),
    fontSize: z.number().int().min(10).max(32).optional(),
    backgroundColor: hexColor.optional(),
    textColor: hexColor.optional(),
    radius: z.number().int().min(0).max(40).optional(),
    hideOn: hideOnSchema.optional(),
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

const emailSectionColumnSchema = z.object({
  id: idSchema,
  width: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  blocks: z.array(emailContentBlockSchema).max(20),
})

export const emailSectionBlockSchema = z.object({
  id: idSchema,
  type: z.literal("section"),
  surface: z.enum(["white", "muted", "brand", "dark"]),
  padding: z.enum(["none", "compact", "comfortable", "spacious"]),
  gap: z.enum(["compact", "comfortable", "spacious"]),
  stackOnMobile: z.boolean(),
  columns: z.array(emailSectionColumnSchema).min(1).max(3),
  backgroundColor: hexColor.optional(),
  contentBackgroundColor: hexColor.optional(),
  backgroundImage: hrefText.optional(),
  backgroundImageOn: z.enum(["row", "content"]).optional(),
  backgroundFit: z.boolean().optional(),
  backgroundRepeat: z.boolean().optional(),
  backgroundCenter: z.boolean().optional(),
  borderWidth: z.number().int().min(0).max(12).optional(),
  borderColor: hexColor.optional(),
  hideOn: hideOnSchema.optional(),
})

export const emailBlockSchema = z.union([
  emailContentBlockSchema,
  emailSectionBlockSchema,
  emailProductBlockSchema,
])

export const emailStudioDocumentSchema = z.object({
  blocks: z.array(emailBlockSchema).max(40),
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

export const emailStudioPreviewQuerySchema = z.object({
  projectId: z.string().uuid(),
})

export const saveEmailStudioTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
})

export const sendEmailStudioTestSchema = z.object({
  id: z.string().uuid(),
  recipient: z.string().trim().email().max(320),
})

export const searchEmailStudioProductsSchema = z.object({
  query: z.string().trim().max(120),
})

export const hydrateEmailStudioProductsSchema = z.object({
  listingIds: z.array(z.string().uuid()).max(4),
})

const generateEmailStudioFromBriefSchema = z.object({
  brief: z.string().trim().min(8, "Describe it in a sentence").max(2000),
  name: z.string().trim().max(120).optional(),
  target: z.enum(["email", "flow"]),
})

const generateEmailStudioFromStructuredBriefSchema = z.object({
  target: z.literal("email"),
  name: z.string().trim().max(120).optional(),
  objective: z.string().trim().min(3, "Add an objective").max(500),
  audience: z.string().trim().min(2, "Add an audience").max(500),
  emailType: z.string().trim().min(2, "Choose an email type").max(120),
  productsOrCategory: z.string().trim().min(2, "Add a product or category").max(1000),
  offer: z.string().trim().max(500).optional(),
  tone: z.string().trim().min(2, "Choose a tone").max(120),
  primaryCta: z.string().trim().min(2, "Add a primary call to action").max(500),
})

export const generateEmailStudioSchema = z.union([
  generateEmailStudioFromStructuredBriefSchema,
  generateEmailStudioFromBriefSchema,
])

export type CreateEmailStudioInput = z.infer<typeof createEmailStudioSchema>
export type UpdateEmailStudioInput = z.infer<typeof updateEmailStudioSchema>
export type GenerateEmailStudioInput = z.infer<typeof generateEmailStudioSchema>
