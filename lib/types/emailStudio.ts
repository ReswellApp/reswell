export const EMAIL_BLOCK_TYPES = [
  "logo",
  "eyebrow",
  "heading",
  "text",
  "image",
  "button",
  "split",
  "details",
  "divider",
  "spacer",
  "footer",
] as const

export type EmailBlockType = (typeof EMAIL_BLOCK_TYPES)[number]

export type EmailAlign = "left" | "center"

export type EmailStudioKind = "project" | "template"

export interface EmailDetailRow {
  id: string
  label: string
  value: string
}

interface EmailBlockBase {
  id: string
}

export interface EmailLogoBlock extends EmailBlockBase {
  type: "logo"
  src: string
  alt: string
  href: string
  width: number
}

export interface EmailEyebrowBlock extends EmailBlockBase {
  type: "eyebrow"
  text: string
  align: EmailAlign
}

export interface EmailHeadingBlock extends EmailBlockBase {
  type: "heading"
  text: string
  align: EmailAlign
}

export interface EmailTextBlock extends EmailBlockBase {
  type: "text"
  text: string
  align: EmailAlign
}

export interface EmailImageBlock extends EmailBlockBase {
  type: "image"
  src: string
  alt: string
  href: string
}

export interface EmailButtonBlock extends EmailBlockBase {
  type: "button"
  label: string
  href: string
  align: EmailAlign
}

export interface EmailSplitBlock extends EmailBlockBase {
  type: "split"
  imageSrc: string
  imageAlt: string
  imageHref: string
  title: string
  text: string
  buttonLabel: string
  buttonHref: string
}

export interface EmailDetailsBlock extends EmailBlockBase {
  type: "details"
  title: string
  rows: EmailDetailRow[]
}

export interface EmailDividerBlock extends EmailBlockBase {
  type: "divider"
}

export interface EmailSpacerBlock extends EmailBlockBase {
  type: "spacer"
  height: number
}

export interface EmailFooterBlock extends EmailBlockBase {
  type: "footer"
  text: string
  showUnsubscribe: boolean
}

export type EmailBlock =
  | EmailLogoBlock
  | EmailEyebrowBlock
  | EmailHeadingBlock
  | EmailTextBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailSplitBlock
  | EmailDetailsBlock
  | EmailDividerBlock
  | EmailSpacerBlock
  | EmailFooterBlock

export interface EmailStudioDocument {
  blocks: EmailBlock[]
}

export interface EmailStudioRecord {
  id: string
  kind: EmailStudioKind
  name: string
  subject: string
  previewText: string
  flowName: string
  flowId: string
  triggerMetric: string
  notes: string
  document: EmailStudioDocument
  klaviyoTemplateId: string | null
  createdAt: string
  updatedAt: string
}

export interface EmailStudioFlowOption {
  id: string
  name: string
  status: string
}
