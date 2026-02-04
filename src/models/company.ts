import { z } from 'zod'

export const CompanySummarySchema = z.object({
  linkedinUrl: z.string().optional(),
  name: z.string().optional(),
  followers: z.string().optional(),
})

export type CompanySummary = z.infer<typeof CompanySummarySchema>

export const EmployeeSchema = z.object({
  name: z.string(),
  designation: z.string().optional(),
  linkedinUrl: z.string().optional(),
})

export type Employee = z.infer<typeof EmployeeSchema>

export const CompanySchema = z.object({
  linkedinUrl: z
    .string()
    .refine((url) => url.includes('linkedin.com/company/'), {
      message: 'Must be a valid LinkedIn company URL (contains /company/)',
    }),
  name: z.string().optional(),
  aboutUs: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  headquarters: z.string().optional(),
  founded: z.string().optional(),
  industry: z.string().optional(),
  companyType: z.string().optional(),
  companySize: z.string().optional(),
  specialties: z.string().optional(),
  headcount: z.number().optional(),
  showcasePages: z.array(CompanySummarySchema).default([]),
  affiliatedCompanies: z.array(CompanySummarySchema).default([]),
  employees: z.array(EmployeeSchema).default([]),
})

export type CompanyData = z.infer<typeof CompanySchema>

export class Company {
  public readonly data: CompanyData

  constructor(data: CompanyData) {
    this.data = CompanySchema.parse(data)
  }

  toJSON() {
    return this.data
  }

  toString() {
    return (
      `<Company ${this.data.name}\n` +
      `  Industry: ${this.data.industry}\n` +
      `  Size: ${this.data.companySize}\n` +
      `  Headquarters: ${this.data.headquarters}\n` +
      `  Employees: ${this.data.employees?.length ?? 0}>`
    )
  }
}
