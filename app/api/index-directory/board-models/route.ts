import { NextRequest, NextResponse } from "next/server"
import {
  getAllIndexBoardModelOptions,
  searchIndexBoardModels,
} from "@/lib/index-directory/board-models-catalog"

/**
 * Public catalog of directory board models for listing forms / autocomplete.
 * GET ?q=optional-filter (substring match, case-insensitive). Omit q for full list (cached).
 */
export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  const items = q ? searchIndexBoardModels(q, 50) : getAllIndexBoardModelOptions()
  return NextResponse.json({ items })
}
