import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { duplicateEmailBlock, insertEmailBlockAfter, removeEmailBlock } from "./document-tree"
import type { EmailStudioDocument } from "@/lib/types/emailStudio"

const document: EmailStudioDocument = {
  blocks: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      type: "section",
      surface: "white",
      padding: "compact",
      gap: "compact",
      stackOnMobile: true,
      columns: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          width: 1,
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              type: "heading",
              text: "Hello",
              align: "left",
            },
          ],
        },
      ],
    },
  ],
}

describe("email studio document tree", () => {
  it("duplicates and removes a block nested in a row", () => {
    const duplicated = duplicateEmailBlock(document, "00000000-0000-4000-8000-000000000003")
    const section = duplicated.document.blocks[0]
    assert.equal(section?.type, "section")
    if (section?.type !== "section") return
    assert.equal(section.columns[0]?.blocks.length, 2)
    assert.equal(section.columns[0]?.blocks[1]?.id, duplicated.id)
    assert.notEqual(duplicated.id, "00000000-0000-4000-8000-000000000003")

    const removed = removeEmailBlock(duplicated.document, duplicated.id)
    const after = removed.blocks[0]
    assert.equal(after?.type, "section")
    if (after?.type !== "section") return
    assert.equal(after.columns[0]?.blocks.length, 1)
  })

  it("inserts a content block beside a nested block", () => {
    const button = {
      id: "00000000-0000-4000-8000-000000000004",
      type: "button" as const,
      label: "Open",
      href: "https://www.reswell.app",
      align: "left" as const,
    }
    const next = insertEmailBlockAfter(document, "00000000-0000-4000-8000-000000000003", button)
    const section = next.blocks[0]
    assert.equal(section?.type, "section")
    if (section?.type !== "section") return
    assert.deepEqual(section.columns[0]?.blocks.map((block) => block.type), ["heading", "button"])
  })
})