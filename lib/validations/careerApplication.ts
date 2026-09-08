import { z } from "zod"

export const CAREER_RESUME_BUCKET = "career-resumes"
export const CAREER_RESUME_MAX_BYTES = 4 * 1024 * 1024

export const CAREER_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const

export const careerApplicationStatusSchema = z.enum(["new", "reviewed", "archived"])

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const careerApplicationSubmitSchema = z.object({
  roleSlug: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: z.preprocess(emptyToNull, z.string().min(7, "Enter a valid phone number").max(32).nullable()),
  surfingNote: z
    .string()
    .trim()
    .min(12, "Give us a bit more on your surfing or buying experience")
    .max(4000),
  favoriteBoard: z
    .string()
    .trim()
    .min(8, "Tell us about a board you have owned")
    .max(2000),
  company: z.preprocess(emptyToNull, z.string().max(120).nullable()),
})

export const careerApplicationStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: careerApplicationStatusSchema,
})

export type CareerApplicationSubmitInput = z.infer<typeof careerApplicationSubmitSchema>
