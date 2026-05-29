"use server"

import { revalidatePath } from "next/cache"
import {
  addCrmContactTagService,
  assignCrmContactService,
  bulkDeleteCrmContactsService,
  bulkUpdateCrmContactsService,
  createCrmBoardInterestService,
  createCrmContactFromProfileService,
  createCrmExternalContactService,
  createCrmTagService,
  deleteCrmBoardInterestService,
  deleteCrmContactService,
  deleteCrmTagService,
  logCrmInteractionService,
  markCrmContactedService,
  removeCrmContactTagService,
  updateCrmBoardInterestService,
  updateCrmContactService,
} from "@/lib/services/crm"

const CRM_PATH = "/admin/crm"

function revalidateCrm() {
  revalidatePath(CRM_PATH)
}

export async function createCrmContactFromProfileAction(raw: unknown) {
  const result = await createCrmContactFromProfileService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function createCrmExternalContactAction(raw: unknown) {
  const result = await createCrmExternalContactService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function updateCrmContactAction(raw: unknown) {
  const result = await updateCrmContactService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function deleteCrmContactAction(raw: unknown) {
  const result = await deleteCrmContactService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function assignCrmContactAction(raw: unknown) {
  const result = await assignCrmContactService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function createCrmTagAction(raw: unknown) {
  const result = await createCrmTagService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const, tagId: result.tagId }
}

export async function deleteCrmTagAction(raw: unknown) {
  const result = await deleteCrmTagService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function addCrmContactTagAction(raw: unknown) {
  const result = await addCrmContactTagService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function removeCrmContactTagAction(raw: unknown) {
  const result = await removeCrmContactTagService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function bulkUpdateCrmContactsAction(raw: unknown) {
  const result = await bulkUpdateCrmContactsService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function bulkDeleteCrmContactsAction(raw: unknown) {
  const result = await bulkDeleteCrmContactsService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function createCrmBoardInterestAction(raw: unknown) {
  const result = await createCrmBoardInterestService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function updateCrmBoardInterestAction(raw: unknown) {
  const result = await updateCrmBoardInterestService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function deleteCrmBoardInterestAction(raw: unknown) {
  const result = await deleteCrmBoardInterestService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function logCrmInteractionAction(raw: unknown) {
  const result = await logCrmInteractionService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}

export async function markCrmContactedAction(raw: unknown) {
  const result = await markCrmContactedService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCrm()
  return { success: true as const }
}
