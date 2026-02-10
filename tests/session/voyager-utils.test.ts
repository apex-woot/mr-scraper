import { describe, expect, test } from 'bun:test'
import {
  buildCookieHeaderFromCookies,
  csrfMatchesJsession,
  extractCookieValue,
  isVoyagerApiUrl,
  normalizeCsrfToken,
  normalizeJsessionId,
} from '../../src/session/voyager-utils'

describe('voyager-utils', () => {
  test('isVoyagerApiUrl matches default matcher', () => {
    expect(isVoyagerApiUrl('https://www.linkedin.com/voyager/api/identity/profiles/sample-user')).toBe(true)
    expect(isVoyagerApiUrl('https://www.linkedin.com/in/sample-user/')).toBe(false)
  })

  test('extractCookieValue pulls cookie values', () => {
    const header = 'li_at=AAA; JSESSIONID="ajax:BBB"; other=CCC'
    expect(extractCookieValue(header, 'li_at')).toBe('AAA')
    expect(extractCookieValue(header, 'JSESSIONID')).toBe('"ajax:BBB"')
    expect(extractCookieValue(header, 'missing')).toBeUndefined()
  })

  test('normalizeJsessionId strips surrounding quotes', () => {
    expect(normalizeJsessionId('"ajax:123"')).toBe('ajax:123')
    expect(normalizeJsessionId('"123"')).toBe('123')
    expect(normalizeJsessionId('ajax:123')).toBe('ajax:123')
  })

  test('normalizeCsrfToken removes ajax: prefix and quotes', () => {
    expect(normalizeCsrfToken('"ajax:123"')).toBe('123')
    expect(normalizeCsrfToken('ajax:123')).toBe('123')
    expect(normalizeCsrfToken('123')).toBe('123')
  })

  test('csrfMatchesJsession compares normalized values', () => {
    const cookieHeader = 'li_at=AAA; JSESSIONID="ajax:BBB"'
    expect(csrfMatchesJsession('ajax:BBB', cookieHeader)).toBe(true)
    expect(csrfMatchesJsession('BBB', cookieHeader)).toBe(true)
    expect(csrfMatchesJsession('CCC', cookieHeader)).toBe(false)
  })

  test('csrfMatchesJsession returns undefined when no JSESSIONID is present', () => {
    const cookieHeader = 'li_at=AAA; other=CCC'
    expect(csrfMatchesJsession('BBB', cookieHeader)).toBeUndefined()
  })

  test('buildCookieHeaderFromCookies selects named cookies', () => {
    const header = buildCookieHeaderFromCookies(
      [
        { name: 'li_at', value: 'AAA' },
        { name: 'JSESSIONID', value: 'BBB' },
        { name: 'other', value: 'CCC' },
      ],
      ['li_at', 'JSESSIONID'],
    )

    expect(header).toBe('li_at=AAA; JSESSIONID=BBB')
  })

  test('buildCookieHeaderFromCookies returns undefined when no requested cookies exist', () => {
    const header = buildCookieHeaderFromCookies([{ name: 'other', value: 'CCC' }], ['li_at'])
    expect(header).toBeUndefined()
  })
})
