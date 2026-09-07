import type { SupabaseClient } from "@supabase/supabase-js"
import type { BoardBuyStatus } from "@/lib/board-buy/constants"
import type { BoardBuyPhoto, BoardBuySubmission } from "@/lib/types/board-buy"

type SubmissionRow = {
  id: string
  user_id: string
  title: string
  asking_price: string | number
  offered_price: string | number | null
  quote_source: "ops" | "auto_sla" | null
  status: BoardBuyStatus
  sla_deadline_at: string
  quoted_at: string | null
  accepted_at: string | null
  declined_at: string | null
  received_at: string | null
  paid_at: string | null
  ops_notes: string | null
  quote_message?: string | null
  seller_note: string | null
  ship_from_name: string
  ship_from_phone: string
  ship_from_line1: string
  ship_from_line2: string | null
  ship_from_city: string
  ship_from_state: string
  ship_from_postal: string
  ship_from_country: string
  parcel_length_in: string | number | null
  parcel_width_in: string | number | null
  parcel_height_in: string | number | null
  parcel_weight_lb: string | number | null
  label_pdf_url: string | null
  label_id: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  created_at: string
  updated_at: string
}

type PhotoRow = {
  id: string
  submission_id: string
  url: string
  sort_order: number
}

function parseMoney(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : parseFloat(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function parseOptNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "number" ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export function mapBoardBuyRow(
  row: SubmissionRow,
  photos: PhotoRow[] = [],
): BoardBuySubmission {
  const asking = parseMoney(row.asking_price)
  if (asking == null) {
    throw new Error("Invalid asking price on board buy submission")
  }
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    askingPrice: asking,
    offeredPrice: parseMoney(row.offered_price),
    quoteSource: row.quote_source,
    status: row.status,
    slaDeadlineAt: row.sla_deadline_at,
    quotedAt: row.quoted_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    receivedAt: row.received_at,
    paidAt: row.paid_at,
    opsNotes: row.ops_notes,
    quoteMessage: row.quote_message ?? null,
    sellerNote: row.seller_note,
    shipFromName: row.ship_from_name,
    shipFromPhone: row.ship_from_phone,
    shipFromLine1: row.ship_from_line1,
    shipFromLine2: row.ship_from_line2,
    shipFromCity: row.ship_from_city,
    shipFromState: row.ship_from_state,
    shipFromPostal: row.ship_from_postal,
    shipFromCountry: row.ship_from_country,
    parcelLengthIn: parseOptNum(row.parcel_length_in),
    parcelWidthIn: parseOptNum(row.parcel_width_in),
    parcelHeightIn: parseOptNum(row.parcel_height_in),
    parcelWeightLb: parseOptNum(row.parcel_weight_lb),
    labelPdfUrl: row.label_pdf_url,
    labelId: row.label_id,
    trackingNumber: row.tracking_number,
    trackingCarrier: row.tracking_carrier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: photos
      .filter((p) => p.submission_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p): BoardBuyPhoto => ({ id: p.id, url: p.url, sortOrder: p.sort_order })),
  }
}

const SUBMISSION_SELECT = "*"

export async function insertBoardBuySubmission(
  supabase: SupabaseClient,
  input: {
    userId: string
    title: string
    askingPrice: number
    sellerNote: string | null
    slaDeadlineAt: string
    shipFromName: string
    shipFromPhone: string
    shipFromLine1: string
    shipFromLine2: string | null
    shipFromCity: string
    shipFromState: string
    shipFromPostal: string
    parcelLengthIn: number | null
    parcelWidthIn: number | null
    parcelHeightIn: number | null
    parcelWeightLb: number | null
  },
): Promise<SubmissionRow> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .insert({
      user_id: input.userId,
      title: input.title,
      asking_price: input.askingPrice.toFixed(2),
      seller_note: input.sellerNote,
      sla_deadline_at: input.slaDeadlineAt,
      ship_from_name: input.shipFromName,
      ship_from_phone: input.shipFromPhone,
      ship_from_line1: input.shipFromLine1,
      ship_from_line2: input.shipFromLine2,
      ship_from_city: input.shipFromCity,
      ship_from_state: input.shipFromState,
      ship_from_postal: input.shipFromPostal,
      ship_from_country: "US",
      parcel_length_in: input.parcelLengthIn,
      parcel_width_in: input.parcelWidthIn,
      parcel_height_in: input.parcelHeightIn,
      parcel_weight_lb: input.parcelWeightLb,
    })
    .select(SUBMISSION_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save submission")
  }
  return data as SubmissionRow
}

export async function insertBoardBuyPhotos(
  supabase: SupabaseClient,
  submissionId: string,
  urls: string[],
): Promise<void> {
  if (urls.length === 0) return
  const { error } = await supabase.from("board_buy_photos").insert(
    urls.map((url, index) => ({
      submission_id: submissionId,
      url,
      sort_order: index,
    })),
  )
  if (error) {
    throw new Error(error.message)
  }
}

export async function listBoardBuySubmissionsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<BoardBuySubmission[]> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .select(SUBMISSION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  const rows = (data ?? []) as SubmissionRow[]
  const photos = await fetchPhotosForSubmissionIds(
    supabase,
    rows.map((r) => r.id),
  )
  return rows.map((row) => mapBoardBuyRow(row, photos))
}

export async function getBoardBuySubmissionForUser(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<BoardBuySubmission | null> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .select(SUBMISSION_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const photos = await fetchPhotosForSubmissionIds(supabase, [id])
  return mapBoardBuyRow(data as SubmissionRow, photos)
}

export async function getBoardBuySubmissionById(
  supabase: SupabaseClient,
  id: string,
): Promise<BoardBuySubmission | null> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .select(SUBMISSION_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const photos = await fetchPhotosForSubmissionIds(supabase, [id])
  return mapBoardBuyRow(data as SubmissionRow, photos)
}

export async function listBoardBuySubmissionsAdmin(
  supabase: SupabaseClient,
): Promise<BoardBuySubmission[]> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .select(SUBMISSION_SELECT)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as SubmissionRow[]
  const photos = await fetchPhotosForSubmissionIds(
    supabase,
    rows.map((r) => r.id),
  )
  return rows.map((row) => mapBoardBuyRow(row, photos))
}

export async function countSubmittedBoardBuys(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("board_buy_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "submitted")
  if (error) return 0
  return count ?? 0
}

export async function listSubmittedPastSla(
  supabase: SupabaseClient,
  nowIso: string,
): Promise<BoardBuySubmission[]> {
  const { data, error } = await supabase
    .from("board_buy_submissions")
    .select(SUBMISSION_SELECT)
    .eq("status", "submitted")
    .lte("sla_deadline_at", nowIso)
    .limit(50)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as SubmissionRow[]
  return rows.map((row) => mapBoardBuyRow(row, []))
}

export async function updateBoardBuySubmission(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("board_buy_submissions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

async function fetchPhotosForSubmissionIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<PhotoRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from("board_buy_photos")
    .select("id, submission_id, url, sort_order")
    .in("submission_id", ids)
  if (error) throw new Error(error.message)
  return (data ?? []) as PhotoRow[]
}
