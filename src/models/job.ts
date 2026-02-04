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

/**
 * Factory function to create and validate a Job data object
 * @param data - Raw job data to validate
 * @returns Validated JobData object
 */
export function createJob(data: JobData): JobData {
  return JobSchema.parse(data)
}

/**
 * Convert JobData to a formatted string representation
 * @param job - JobData object
 * @returns Formatted string with job details
 */
export function jobToString(job: JobData): string {
  return (
    `<Job ${job.jobTitle} at ${job.company}\n` +
    `  Location: ${job.location}\n` +
    `  Posted: ${job.postedDate}\n` +
    `  Applicants: ${job.applicantCount}>`
  )
}

