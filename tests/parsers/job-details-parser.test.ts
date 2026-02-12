import { describe, expect, test } from 'bun:test'
import { JobDetailsParser } from '../../src/extraction/parsers'

describe('JobDetailsParser', () => {
  const parser = new JobDetailsParser()

  test('parses known criteria keys into typed result', () => {
    const parsed = parser.parse({
      texts: [
        'Job details',
        'Employment type',
        'Full-time',
        'Seniority level',
        'Mid-Senior level',
        'Job function',
        'Engineering',
        'Industries',
        'Software Development, Internet',
      ],
      links: [],
      context: {},
    })

    expect(parsed).toEqual({
      employmentType: 'Full-time',
      seniorityLevel: 'Mid-Senior level',
      jobFunction: 'Engineering',
      industries: ['Software Development', 'Internet'],
    })
    expect(parsed).not.toBeNull()
    if (!parsed) throw new Error('Expected parse result')
    expect(parser.validate(parsed)).toBe(true)
  })
})
