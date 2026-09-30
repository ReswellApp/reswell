import type {
  EmailBlock,
  EmailStudioDocument,
} from "@/lib/types/emailStudio"

export type EmailStudioPreflightSeverity = "error" | "warning"

export interface EmailStudioPreflightIssue {
  code: string
  severity: EmailStudioPreflightSeverity
  message: string
  blockId?: string
}

export interface EmailStudioPreflightInput {
  subject: string
  previewText: string
  document: EmailStudioDocument
}

const VALID_LINK = /^(https:\/\/|mailto:|\{\{|\{%)/i

function linkIssue(
  value: string,
  label: string,
  blockId: string,
  required: boolean,
): EmailStudioPreflightIssue | null {
  const link = value.trim()
  if (!link) {
    return required
      ? { code: "missing-link", severity: "error", message: `${label} is missing a link.`, blockId }
      : null
  }
  if (!VALID_LINK.test(link)) {
    return {
      code: "invalid-link",
      severity: "error",
      message: `${label} must use HTTPS, mailto, or a Klaviyo variable.`,
      blockId,
    }
  }
  return null
}

function templateIssues(value: string, label: string, blockId?: string): EmailStudioPreflightIssue[] {
  if (!/[{}%]/.test(value)) return []
  const withoutValidTags = value
    .replace(/\{\{[\s\S]+?\}\}/g, "")
    .replace(/\{%[\s\S]+?%\}/g, "")
  const issues: EmailStudioPreflightIssue[] = []
  if (/\{\{|\}\}|\{%|%\}/.test(withoutValidTags)) {
    issues.push({
      code: "malformed-variable",
      severity: "error",
      message: `${label} contains an unclosed or mismatched Klaviyo tag.`,
      ...(blockId ? { blockId } : {}),
    })
  }
  if (/\{\{\s*\}\}|\{%\s*%\}/.test(value)) {
    issues.push({
      code: "empty-variable",
      severity: "error",
      message: `${label} contains an empty Klaviyo tag.`,
      ...(blockId ? { blockId } : {}),
    })
  }
  return issues
}

function pushTextIssues(
  issues: EmailStudioPreflightIssue[],
  value: string,
  label: string,
  blockId: string,
  required = true,
): void {
  if (required && !value.trim()) {
    issues.push({
      code: "missing-content",
      severity: "error",
      message: `${label} is empty.`,
      blockId,
    })
  }
  issues.push(...templateIssues(value, label, blockId))
}

function validateBlock(block: EmailBlock, issues: EmailStudioPreflightIssue[]): void {
  if (block.type === "section") {
    if (block.columns.every((column) => column.blocks.length === 0)) {
      issues.push({
        code: "empty-section",
        severity: "error",
        message: "A section has no content.",
        blockId: block.id,
      })
    }
    block.columns.forEach((column) => column.blocks.forEach((child) => validateBlock(child, issues)))
    return
  }
  if (block.type === "product") {
    if (block.listingIds.length === 0 || block.items.length === 0) {
      issues.push({
        code: "missing-products",
        severity: "error",
        message: "Choose at least one listing for the product block.",
        blockId: block.id,
      })
    }
    if (block.listingIds.some((id) => !block.items.some((item) => item.id === id))) {
      issues.push({
        code: "missing-product-snapshot",
        severity: "error",
        message: "Refresh this product block; one or more listings could not be loaded.",
        blockId: block.id,
      })
    }
    for (const item of block.items) {
      const issue = linkIssue(item.productUrl, item.title || "Product", block.id, true)
      if (issue) issues.push(issue)
      if (!item.imageUrl.trim()) {
        issues.push({
          code: "missing-product-image",
          severity: "warning",
          message: `${item.title || "A selected listing"} has no product image.`,
          blockId: block.id,
        })
      }
      if (item.availability === "sold" || item.availability === "unavailable") {
        issues.push({
          code: "unavailable-product",
          severity: "warning",
          message: `${item.title || "A selected listing"} is ${item.availability}.`,
          blockId: block.id,
        })
      }
    }
    pushTextIssues(issues, block.title, "Product section title", block.id, false)
    pushTextIssues(issues, block.ctaLabel, "Product button label", block.id)
    return
  }
  if (block.type === "logo") {
    if (!block.src.trim()) {
      issues.push({ code: "missing-image", severity: "error", message: "The logo image is missing.", blockId: block.id })
    }
    if (!block.alt.trim()) {
      issues.push({ code: "missing-alt", severity: "warning", message: "The logo needs alt text.", blockId: block.id })
    }
    const issue = linkIssue(block.href, "Logo", block.id, false)
    if (issue) issues.push(issue)
    return
  }
  if (block.type === "eyebrow" || block.type === "heading" || block.type === "text") {
    pushTextIssues(issues, block.text, block.type === "heading" ? "Headline" : block.type === "text" ? "Text block" : "Eyebrow", block.id)
    return
  }
  if (block.type === "image") {
    if (!block.src.trim()) {
      issues.push({ code: "missing-image", severity: "error", message: "An image block has no image.", blockId: block.id })
    }
    if (!block.alt.trim()) {
      issues.push({ code: "missing-alt", severity: "warning", message: "An image needs alt text.", blockId: block.id })
    }
    const issue = linkIssue(block.href, "Image", block.id, false)
    if (issue) issues.push(issue)
    return
  }
  if (block.type === "button") {
    pushTextIssues(issues, block.label, "Button label", block.id)
    const issue = linkIssue(block.href, block.label || "Button", block.id, true)
    if (issue) issues.push(issue)
    issues.push(...templateIssues(block.href, block.label || "Button link", block.id))
    return
  }
  if (block.type === "split") {
    if (!block.imageSrc.trim()) {
      issues.push({ code: "missing-image", severity: "error", message: "An image-and-text block has no image.", blockId: block.id })
    }
    if (!block.imageAlt.trim()) {
      issues.push({ code: "missing-alt", severity: "warning", message: "An image-and-text block needs alt text.", blockId: block.id })
    }
    pushTextIssues(issues, block.title, "Image-and-text title", block.id)
    pushTextIssues(issues, block.text, "Image-and-text copy", block.id)
    if (block.buttonLabel.trim()) {
      const issue = linkIssue(block.buttonHref, block.buttonLabel, block.id, true)
      if (issue) issues.push(issue)
      issues.push(...templateIssues(block.buttonHref, `${block.buttonLabel} link`, block.id))
    }
    return
  }
  if (block.type === "details") {
    if (block.rows.length === 0) {
      issues.push({ code: "missing-details", severity: "error", message: "A details block has no rows.", blockId: block.id })
    }
    for (const row of block.rows) {
      pushTextIssues(issues, row.label, "Details label", block.id)
      pushTextIssues(issues, row.value, `${row.label || "Details"} value`, block.id)
    }
    return
  }
  if (block.type === "footer") {
    pushTextIssues(issues, block.text, "Footer", block.id)
    if (!block.showUnsubscribe) {
      issues.push({
        code: "missing-unsubscribe",
        severity: "error",
        message: "The email must include an unsubscribe link.",
        blockId: block.id,
      })
    }
  }
}

function validateCustomHtml(html: string): EmailStudioPreflightIssue[] {
  const issues = templateIssues(html, "Custom HTML")
  if (!/<(?:p|h[1-6]|td|div|img|a)\b/i.test(html)) {
    issues.push({ code: "missing-content", severity: "error", message: "Custom HTML has no visible email content." })
  }
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const issue = linkIssue(match[1] ?? match[2] ?? "", "Custom HTML link or image", "custom-html", true)
    if (issue) issues.push({ ...issue, blockId: undefined })
  }
  if (!/\{%\s*unsubscribe\b/i.test(html)) {
    issues.push({ code: "missing-unsubscribe", severity: "error", message: "Custom HTML must include a Klaviyo unsubscribe tag." })
  }
  return issues
}

function hasUnsubscribeFooter(blocks: EmailBlock[]): boolean {
  return blocks.some((block) => {
    if (block.type === "footer") return block.showUnsubscribe
    return block.type === "section"
      ? block.columns.some((column) => hasUnsubscribeFooter(column.blocks))
      : false
  })
}

export function validateEmailStudioPreflight(
  input: EmailStudioPreflightInput,
): EmailStudioPreflightIssue[] {
  const issues: EmailStudioPreflightIssue[] = []
  if (!input.subject.trim()) {
    issues.push({ code: "missing-subject", severity: "error", message: "Add a subject line." })
  }
  issues.push(...templateIssues(input.subject, "Subject line"))
  if (!input.previewText.trim()) {
    issues.push({ code: "missing-preview-text", severity: "warning", message: "Add inbox preview text." })
  }
  issues.push(...templateIssues(input.previewText, "Preview text"))

  const customHtml = input.document.htmlOverride?.trim()
  if (customHtml) return [...issues, ...validateCustomHtml(customHtml)]
  if (input.document.blocks.length === 0) {
    issues.push({ code: "empty-email", severity: "error", message: "Add content before publishing." })
    return issues
  }
  input.document.blocks.forEach((block) => validateBlock(block, issues))
  if (!hasUnsubscribeFooter(input.document.blocks)) {
    issues.push({ code: "missing-footer", severity: "error", message: "Add a footer with an unsubscribe link." })
  }
  return issues
}
