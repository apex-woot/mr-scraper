import { describe, expect, test } from 'bun:test'
import { buildResumePdfFileName } from './resume'

describe('buildResumePdfFileName', () => {
  test('prefers user-provided file name and appends pdf extension', () => {
    const result = buildResumePdfFileName('https://www.linkedin.com/in/sample-user/', undefined, 'my resume')
    expect(result).toBe('my_resume.pdf')
  })

  test('uses person name when no explicit file name is provided', () => {
    const result = buildResumePdfFileName(
      'https://www.linkedin.com/in/sample-user/',
      'Stacy (Weinstein) Ehrlich',
      undefined,
      'LinkedIn Profile.pdf',
    )
    expect(result).toBe('Stacy_Weinstein_Ehrlich.pdf')
  })

  test('falls back to download suggested filename', () => {
    const result = buildResumePdfFileName(
      'https://www.linkedin.com/in/sample-user/',
      undefined,
      undefined,
      'LinkedIn Profile.pdf',
    )
    expect(result).toBe('LinkedIn_Profile.pdf')
  })

  test('uses linkedin profile slug when no file names are provided', () => {
    const result = buildResumePdfFileName('https://www.linkedin.com/in/example-person-123/', undefined)
    expect(result).toBe('linkedin_resume_example-person-123.pdf')
  })
})
