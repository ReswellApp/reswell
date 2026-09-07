import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ExcelJS from "exceljs"
import type { FacebookMarketplaceBulkRow } from "@/lib/facebook-marketplace/map-listing"

const TEMPLATE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "templates",
  "Marketplace_Bulk_Upload_Template.xlsx",
)

const TEMPLATE_SHEET_NAME = "Bulk Upload Template"
const FIRST_DATA_ROW = 5

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const buffer = await readFile(TEMPLATE_PATH)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

function writeRow(sheet: ExcelJS.Worksheet, rowNumber: number, row: FacebookMarketplaceBulkRow): void {
  const excelRow = sheet.getRow(rowNumber)
  excelRow.getCell(1).value = row.title
  excelRow.getCell(2).value = row.price
  excelRow.getCell(3).value = row.condition
  excelRow.getCell(4).value = row.description
  excelRow.getCell(5).value = row.category
  excelRow.commit()
}

/**
 * Fills Facebook's official Marketplace bulk-upload workbook (rows start at 5).
 * Preserves the hidden VALIDATION sheet and dropdowns.
 */
export async function buildFacebookMarketplaceBulkUploadXlsx(
  rows: FacebookMarketplaceBulkRow[],
): Promise<Buffer> {
  if (rows.length === 0) {
    throw new Error("No listings to export")
  }

  const workbook = await loadTemplateWorkbook()
  const sheet = workbook.getWorksheet(TEMPLATE_SHEET_NAME)
  if (!sheet) {
    throw new Error("Facebook Marketplace template is missing the Bulk Upload Template sheet")
  }

  rows.forEach((row, index) => {
    writeRow(sheet, FIRST_DATA_ROW + index, row)
  })

  const out = await workbook.xlsx.writeBuffer()
  return Buffer.from(out)
}
