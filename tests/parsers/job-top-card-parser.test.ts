import { describe, expect, test } from 'bun:test'
import { JobTopCardParser } from '../../src/extraction/parsers'

describe('JobTopCardParser', () => {
  const parser = new JobTopCardParser()

  test('parses title/company/location/workplace/posting and applicants', () => {
    const parsed = parser.parse({
      texts: [
        'Staff Software Engineer',
        'Example Company',
        'Example City, Example State, United States (Hybrid)',
        'Reposted 3 days ago · 42 applicants',
      ],
      links: [
        {
          url: 'https://www.linkedin.com/company/example-company/',
          text: 'Example Company',
          isExternal: true,
        },
        {
          url: 'https://www.linkedin.com/jobs/view/1234567890/',
          text: 'Job',
          isExternal: true,
        },
      ],
      context: {},
    })

    expect(parsed).toEqual({
      title: 'Staff Software Engineer',
      companyName: 'Example Company',
      companyUrl: 'https://www.linkedin.com/company/example-company/',
      location: 'Example City, Example State, United States',
      workplaceType: 'Hybrid',
      postedAt: 'Reposted 3 days ago',
      applicantCount: 42,
      jobId: '1234567890',
    })
    expect(parsed).not.toBeNull()
    if (!parsed) throw new Error('Expected parse result')
    expect(parser.validate(parsed)).toBe(true)
  })
})
