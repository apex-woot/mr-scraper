import { describe, expect, test } from 'bun:test'
import { buildResumePdfFileName } from './resume'

describe('buildResumePdfFileName', () => {
  test('prefers user-provided file name and appends pdf extension', () => {
    const result = buildResumePdfFileName('https://www.linkedin.com/in/sample-user/', undefined, 'my resume')
    expect(result).toBe('my_resume.pdf')
  })

  test('keeps explicit file name precedence over person name and suggestion', () => {
    const result = buildResumePdfFileName(
      'https://www.linkedin.com/in/sample-user/',
      'Sample User',
      'custom-name',
      'LinkedIn Profile.pdf',
    )
    expect(result).toBe('custom-name.pdf')
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

  test('sanitizes special characters in person name', () => {
    const result = buildResumePdfFileName('https://www.linkedin.com/in/sample-user/', "Alex O'Neil / R&D")
    expect(result).toBe('Alex_O_Neil_R_D.pdf')
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

  test('ignores Unknown person name and falls back to suggested filename', () => {
    const result = buildResumePdfFileName(
      'https://www.linkedin.com/in/sample-user/',
      'Unknown',
      undefined,
      'LinkedIn Resume.pdf',
    )
    expect(result).toBe('LinkedIn_Resume.pdf')
  })

  test('uses linkedin profile slug when no file names are provided', () => {
    const result = buildResumePdfFileName('https://www.linkedin.com/in/example-person-123/', undefined)
    expect(result).toBe('linkedin_resume_example-person-123.pdf')
  })
})
