import { z } from 'zod'

export const JobSchema = z.object({
  linkedinUrl: z.string().refine((url) => url.includes('linkedin.com/jobs/view/'), {
    message: 'Must be a valid LinkedIn job URL (contains /jobs/view/)',
  }),
  jobId: z.string().optional(),
  title: z.string().optional(),
  companyName: z.string().optional(),
  companyUrl: z.string().optional(),
  location: z.string().optional(),
  workplaceType: z.string().optional(),
  postedAt: z.string().optional(),
  applicantCount: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  employmentType: z.string().optional(),
  seniorityLevel: z.string().optional(),
  jobFunction: z.string().optional(),
  industries: z.array(z.string()).default([]),
})

export type JobData = z.infer<typeof JobSchema>

export interface JobSummary {
  title: string | null
  companyName: string | null
  location: string | null
  postedAt: string | null
}

export function createJob(data: JobData): JobData {
  return JobSchema.parse(data)
}

export function getJobSummary(job: JobData): JobSummary {
  return {
    title: job.title ?? null,
    companyName: job.companyName ?? null,
    location: job.location ?? null,
    postedAt: job.postedAt ?? null,
  }
}
