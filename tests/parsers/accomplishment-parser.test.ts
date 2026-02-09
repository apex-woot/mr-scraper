import { describe, expect, test } from 'bun:test'
import { AccomplishmentParser } from '../../src/extraction/parsers'

describe('AccomplishmentParser', () => {
  const parser = new AccomplishmentParser()

  test('parses accomplishment fields from text patterns', () => {
    const parsed = parser.parse({
      texts: ['AWS Certified Developer', 'Issued by Amazon Web Services · Jan 2024', 'Credential ID ABC-123'],
      links: [{ url: 'https://example.test/verify', text: 'verify', isExternal: true }],
      context: { category: 'certification' },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.category).toBe('certification')
    expect(parsed?.title).toBe('AWS Certified Developer')
    expect(parsed?.issuer).toBe('Amazon Web Services')
    expect(parsed?.issuedDate).toBe('Jan 2024')
    expect(parsed?.credentialId).toBe('ABC-123')
    expect(parsed?.credentialUrl).toBe('https://example.test/verify')
    if (!parsed) throw new Error('Expected parsed accomplishment')
    expect(parser.validate(parsed)).toBe(true)
  })

  test('splits issuer and date when combined in publication metadata', () => {
    const parsed = parser.parse({
      texts: ['Example Publication Title', 'Example Conference · Dec 11, 2024'],
      links: [],
      context: { category: 'publication' },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.issuer).toBe('Example Conference')
    expect(parsed?.issuedDate).toBe('Dec 11, 2024')
  })
})
