import { cloneEmailBlock } from "@/lib/email-studio/document"
import type {
  EmailBlock,
  EmailContentBlock,
  EmailSectionBlock,
  EmailStudioDocument,
} from "@/lib/types/emailStudio"

export interface EmailBlockLocation {
  block: EmailBlock
  topLevelIndex: number
  sectionId: string | null
  columnId: string | null
  childIndex: number | null
}

export function findEmailBlock(
  document: EmailStudioDocument,
  blockId: string | null,
): EmailBlockLocation | null {
  if (!blockId) return null
  for (let topLevelIndex = 0; topLevelIndex < document.blocks.length; topLevelIndex += 1) {
    const block = document.blocks[topLevelIndex]
    if (!block) continue
    if (block.id === blockId) {
      return { block, topLevelIndex, sectionId: null, columnId: null, childIndex: null }
    }
    if (block.type !== "section") continue
    for (const column of block.columns) {
      const childIndex = column.blocks.findIndex((child) => child.id === blockId)
      const child = column.blocks[childIndex]
      if (child) {
        return {
          block: child,
          topLevelIndex,
          sectionId: block.id,
          columnId: column.id,
          childIndex,
        }
      }
    }
  }
  return null
}

export function flattenEmailBlocks(document: EmailStudioDocument): EmailBlock[] {
  const flattened: EmailBlock[] = []
  for (const block of document.blocks) {
    flattened.push(block)
    if (block.type === "section") {
      flattened.push(...block.columns.flatMap((column) => column.blocks))
    }
  }
  return flattened
}

export function replaceEmailBlock(
  document: EmailStudioDocument,
  replacement: EmailBlock,
): EmailStudioDocument {
  const location = findEmailBlock(document, replacement.id)
  if (!location) throw new Error("That email block no longer exists.")
  if (!location.sectionId || !location.columnId || location.childIndex === null) {
    return {
      ...document,
      blocks: document.blocks.map((block) => block.id === replacement.id ? replacement : block),
      htmlOverride: null,
    }
  }
  if (replacement.type === "section" || replacement.type === "product") {
    throw new Error("Sections and product blocks cannot be nested inside another section.")
  }
  return {
    ...document,
    htmlOverride: null,
    blocks: document.blocks.map((block) => {
      if (block.type !== "section" || block.id !== location.sectionId) return block
      return {
        ...block,
        columns: block.columns.map((column) => (
          column.id === location.columnId
            ? {
                ...column,
                blocks: column.blocks.map((child) => (
                  child.id === replacement.id ? replacement as EmailContentBlock : child
                )),
              }
            : column
        )),
      }
    }),
  }
}

export function removeEmailBlock(
  document: EmailStudioDocument,
  blockId: string,
): EmailStudioDocument {
  const location = findEmailBlock(document, blockId)
  if (!location) throw new Error("That email block no longer exists.")
  if (!location.sectionId || !location.columnId) {
    return {
      ...document,
      blocks: document.blocks.filter((block) => block.id !== blockId),
      htmlOverride: null,
    }
  }
  return {
    ...document,
    htmlOverride: null,
    blocks: document.blocks.map((block) => {
      if (block.type !== "section" || block.id !== location.sectionId) return block
      return {
        ...block,
        columns: block.columns.map((column) => (
          column.id === location.columnId
            ? { ...column, blocks: column.blocks.filter((child) => child.id !== blockId) }
            : column
        )),
      }
    }),
  }
}

export function updateEmailSection(
  document: EmailStudioDocument,
  section: EmailSectionBlock,
): EmailStudioDocument {
  return replaceEmailBlock(document, section)
}

export function duplicateEmailBlock(
  document: EmailStudioDocument,
  blockId: string,
): { document: EmailStudioDocument; id: string } {
  const location = findEmailBlock(document, blockId)
  if (!location) throw new Error("That email block no longer exists.")
  const copy = cloneEmailBlock(location.block)
  if (!location.sectionId || !location.columnId || location.childIndex === null) {
    const blocks = [...document.blocks]
    blocks.splice(location.topLevelIndex + 1, 0, copy)
    return { document: { ...document, blocks, htmlOverride: null }, id: copy.id }
  }
  if (copy.type === "section" || copy.type === "product") {
    throw new Error("Sections and product blocks cannot be nested inside another section.")
  }
  const child = copy
  return {
    id: child.id,
    document: {
      ...document,
      htmlOverride: null,
      blocks: document.blocks.map((block) => {
        if (block.type !== "section" || block.id !== location.sectionId) return block
        return {
          ...block,
          columns: block.columns.map((column) => {
            if (column.id !== location.columnId || location.childIndex === null) return column
            const blocks = [...column.blocks]
            blocks.splice(location.childIndex + 1, 0, child)
            return { ...column, blocks }
          }),
        }
      }),
    },
  }
}

export function insertEmailBlockAfter(
  document: EmailStudioDocument,
  afterId: string,
  block: EmailBlock,
): EmailStudioDocument {
  const location = findEmailBlock(document, afterId)
  if (!location) throw new Error("That email block no longer exists.")
  const nest = Boolean(location.sectionId && location.columnId && location.childIndex !== null)
  if (!nest || block.type === "section" || block.type === "product") {
    const blocks = [...document.blocks]
    blocks.splice(location.topLevelIndex + 1, 0, block)
    return { ...document, blocks, htmlOverride: null }
  }
  const child = block
  return {
    ...document,
    htmlOverride: null,
    blocks: document.blocks.map((item) => {
      if (item.type !== "section" || item.id !== location.sectionId) return item
      return {
        ...item,
        columns: item.columns.map((column) => {
          if (column.id !== location.columnId || location.childIndex === null) return column
          const blocks = [...column.blocks]
          blocks.splice(location.childIndex + 1, 0, child)
          return { ...column, blocks }
        }),
      }
    }),
  }
}
