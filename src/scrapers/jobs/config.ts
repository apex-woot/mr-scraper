import { z } from 'zod'

export const JobDomExtractorToggleSchema = z.object({
  summary: z.boolean().default(true),
  description: z.boolean().default(true),
  details: z.boolean().default(true),
})

export type JobDomExtractorToggles = z.infer<typeof JobDomExtractorToggleSchema>
