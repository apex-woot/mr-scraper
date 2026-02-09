import { z } from 'zod'

export const PersonDomExtractorToggleSchema = z.object({
  summary: z.boolean().default(true),
  about: z.boolean().default(true),
  contacts: z.boolean().default(true),
  educations: z.boolean().default(true),
  experiences: z.boolean().default(true),
  patents: z.boolean().default(true),
  publications: z.boolean().default(true),
  interests: z.boolean().default(false),
  accomplishments: z.boolean().default(false),
})

export const PersonScraperConfigSchema = z.object({
  domExtractors: PersonDomExtractorToggleSchema,
})

export type PersonDomExtractorToggles = z.infer<typeof PersonDomExtractorToggleSchema>
export type PersonScraperConfig = z.infer<typeof PersonScraperConfigSchema>

export const PERSON_CORE_SECTIONS_CONFIG: PersonScraperConfig = PersonScraperConfigSchema.parse({
  domExtractors: {},
})
