import { z } from 'zod'

export const InterestSchema = z.object({
  name: z.string(),
  category: z.string(),
  linkedinUrl: z.string().optional(),
})

export type Interest = z.infer<typeof InterestSchema>

export const ContactSchema = z.object({
  type: z.string(),
  value: z.string(),
  label: z.string().optional(),
})

export type Contact = z.infer<typeof ContactSchema>

export const ExperienceSchema = z.object({
  positionTitle: z.string().optional(),
  institutionName: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  duration: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
})

export type Experience = z.infer<typeof ExperienceSchema>

export const EducationSchema = z.object({
  institutionName: z.string().optional(),
  degree: z.string().optional(),
  linkedinUrl: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  description: z.string().optional(),
})

export type Education = z.infer<typeof EducationSchema>

export const AccomplishmentSchema = z.object({
  category: z.string(),
  title: z.string(),
  issuer: z.string().optional(),
  issuedDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().optional(),
  description: z.string().optional(),
})

export type Accomplishment = z.infer<typeof AccomplishmentSchema>

export const PersonSchema = z.object({
  linkedinUrl: z.string().refine((url) => url.includes('linkedin.com/in/'), {
    message: 'Must be a valid LinkedIn profile URL (contains /in/)',
  }),
  name: z.string().optional(),
  location: z.string().optional(),
  about: z.string().optional(),
  openToWork: z.boolean().default(false),
  experiences: z.array(ExperienceSchema).default([]),
  educations: z.array(EducationSchema).default([]),
  interests: z.array(InterestSchema).default([]),
  accomplishments: z.array(AccomplishmentSchema).default([]),
  contacts: z.array(ContactSchema).default([]),
})

export type PersonData = z.infer<typeof PersonSchema>

export class Person {
  public readonly data: PersonData

  constructor(data: PersonData) {
    this.data = PersonSchema.parse(data)
  }

  get company(): string | undefined {
    return this.data.experiences[0]?.institutionName
  }

  get jobTitle(): string | undefined {
    return this.data.experiences[0]?.positionTitle
  }

  toJSON() {
    return this.data
  }

  toString() {
    return (
      `<Person ${this.data.name}\n` +
      `  Company: ${this.company}\n` +
      `  Title: ${this.jobTitle}\n` +
      `  Location: ${this.data.location}\n` +
      `  Experiences: ${this.data.experiences.length}\n` +
      `  Education: ${this.data.educations.length}>`
    )
  }
}
