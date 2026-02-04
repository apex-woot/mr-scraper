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

/**
 * Factory function to create and validate a Company data object
 * @param data - Raw company data to validate
 * @returns Validated CompanyData object
 */
export function createCompany(data: CompanyData): CompanyData {
  return CompanySchema.parse(data)
}

/**
 * Convert CompanyData to a formatted string representation
 * @param company - CompanyData object
 * @returns Formatted string with company details
 */
export function companyToString(company: CompanyData): string {
  return (
    `<Company ${company.name}\n` +
    `  Industry: ${company.industry}\n` +
    `  Size: ${company.companySize}\n` +
    `  Headquarters: ${company.headquarters}\n` +
    `  Employees: ${company.employees?.length ?? 0}>`
  )
}

