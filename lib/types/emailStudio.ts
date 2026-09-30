export const EMAIL_BLOCK_TYPES = [
  "section",
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

export const EMAIL_STUDIO_DOCUMENT_SCHEMA_VERSION = 2

export type EmailBlockType = (typeof EMAIL_BLOCK_TYPES)[number]

export type EmailAlign = "left" | "center"
export type EmailHideOn = "desktop" | "mobile"
export type EmailFontWeight = "normal" | "bold"
export type EmailFontFamily = "sans" | "headline"

export type EmailStudioKind = "project" | "template"
export type EmailSectionSurface = "white" | "muted" | "brand" | "dark"
export type EmailSectionPadding = "none" | "compact" | "comfortable" | "spacious"

/** Optional paint. Omitted fields keep the existing email styles. */
export interface EmailTextStyle {
  color?: string
  fontSize?: number
  fontWeight?: EmailFontWeight
  italic?: boolean
  underline?: boolean
  strike?: boolean
  hideOn?: EmailHideOn
}

export interface EmailPadding {
  top: number
  right: number
  bottom: number
  left: number
}

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

export interface EmailEyebrowBlock extends EmailBlockBase, EmailTextStyle {
  type: "eyebrow"
  text: string
  align: EmailAlign
}

export interface EmailHeadingBlock extends EmailBlockBase, EmailTextStyle {
  type: "heading"
  text: string
  align: EmailAlign
}

export interface EmailTextBlock extends EmailBlockBase, EmailTextStyle {
  type: "text"
  text: string
  align: EmailAlign
}

export interface EmailImageBlock extends EmailBlockBase {
  type: "image"
  src: string
  alt: string
  href: string
  /** Display width in pixels. Omitted images use the full email column. */
  width?: number
  /** Set with width to crop. Empty keeps the photo's natural height. */
  height?: number | null
  /** Corner radius in pixels. Omitted images keep the 8px email radius. */
  radius?: number
  padding?: EmailPadding
  hideOn?: EmailHideOn
}

export interface EmailButtonBlock extends EmailBlockBase {
  type: "button"
  label: string
  href: string
  align: EmailAlign
  /** Hugs the label when omitted. Set to stretch across the column. */
  fullWidth?: boolean
  fontFamily?: EmailFontFamily
  fontWeight?: EmailFontWeight
  fontSize?: number
  backgroundColor?: string
  textColor?: string
  radius?: number
  hideOn?: EmailHideOn
}

export interface EmailSplitBlock extends EmailBlockBase {
  type: "split"
  imageSrc: string
  imageAlt: string
  imageHref: string
  imageWidth?: number
  imageHeight?: number | null
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

export type EmailContentBlock =
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

export interface EmailSectionColumn {
  id: string
  width: 1 | 2 | 3
  blocks: EmailContentBlock[]
}

export interface EmailSectionBlock extends EmailBlockBase {
  type: "section"
  surface: EmailSectionSurface
  padding: EmailSectionPadding
  gap: "compact" | "comfortable" | "spacious"
  stackOnMobile: boolean
  columns: EmailSectionColumn[]
  backgroundColor?: string
  contentBackgroundColor?: string
  backgroundImage?: string
  backgroundImageOn?: "row" | "content"
  backgroundFit?: boolean
  backgroundRepeat?: boolean
  backgroundCenter?: boolean
  borderWidth?: number
  borderColor?: string
  hideOn?: EmailHideOn
}

export type EmailBlock = EmailContentBlock | EmailSectionBlock

export interface EmailStudioDocument {
  blocks: EmailBlock[]
  /** Hand-edited HTML. When set, download and Klaviyo push use this instead of the blocks. */
  htmlOverride?: string | null
}

export interface EmailStudioRecord {
  id: string
  kind: EmailStudioKind
  schemaVersion: number
  revision: number
  name: string
  subject: string
  previewText: string
  flowName: string
  flowId: string
  triggerMetric: string
  notes: string
  document: EmailStudioDocument
  klaviyoTemplateId: string | null
  klaviyoSyncedRevision: number | null
  klaviyoContentChecksum: string | null
  klaviyoSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EmailStudioFlowOption {
  id: string
  name: string
  status: string
}

export interface EmailStudioPreviewProfile {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
}

export interface EmailStudioPreviewEvent {
  id: string
  metricName: string
  occurredAt: string
  properties: Record<string, unknown>
  profile: EmailStudioPreviewProfile | null
}
