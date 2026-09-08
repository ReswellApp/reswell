export const CAREER_APPLICATION_STATUSES = ["new", "reviewed", "archived"] as const

export type CareerApplicationStatus = (typeof CAREER_APPLICATION_STATUSES)[number]

export type CareerApplication = {
  id: string
  roleSlug: string | null
  roleTitle: string
  name: string
  email: string
  phone: string | null
  surfingNote: string
  favoriteBoard: string
  resumeStoragePath: string | null
  resumeFileName: string | null
  resumeMimeType: string | null
  resumeSizeBytes: number | null
  status: CareerApplicationStatus
  createdAt: string
  updatedAt: string
}

export type CareerApplicationAdminDetail = CareerApplication & {
  resumeSignedUrl: string | null
}
