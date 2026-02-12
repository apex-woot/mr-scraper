import { describe, expect, test } from 'bun:test'
import { JobDescriptionParser } from '../../src/extraction/parsers'

describe('JobDescriptionParser', () => {
  const parser = new JobDescriptionParser()

  test('joins lines and filters heading / show more noise', () => {
    const parsed = parser.parse({
      texts: ['About the job', 'We build resilient systems.', 'Show more', 'See less'],
      links: [],
      context: {},
    })

    expect(parsed).toBe('We build resilient systems.')
    expect(parsed).toBeDefined()
    if (!parsed) throw new Error('Expected parse result')
    expect(parser.validate(parsed)).toBe(true)
  })
})
