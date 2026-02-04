import { z } from 'zod'

export const JobSchema = z.object({
  linkedinUrl: z.string().refine((url) => url.includes('linkedin.com/jobs'), {
    message: 'Must be a valid LinkedIn job URL (contains /jobs)',
  }),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  companyLinkedinUrl: z.string().optional(),
  location: z.string().optional(),
  postedDate: z.string().optional(),
  applicantCount: z.string().optional(),
  jobDescription: z.string().optional(),
  benefits: z.string().optional(),
})

export type JobData = z.infer<typeof JobSchema>

export class Job {
  public readonly data: JobData

  constructor(data: JobData) {
    this.data = JobSchema.parse(data)
  }

  toJSON() {
    return this.data
  }

  toString() {
    return (
      `<Job ${this.data.jobTitle} at ${this.data.company}\n` +
      `  Location: ${this.data.location}\n` +
      `  Posted: ${this.data.postedDate}\n` +
      `  Applicants: ${this.data.applicantCount}>`
    )
  }
}
