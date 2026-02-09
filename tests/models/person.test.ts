import { describe, expect, test } from 'bun:test'
import { createPerson, getProfileSummary } from '../../src/models'

describe('getProfileSummary', () => {
  test('returns preferred top-card fields when present', () => {
    const person = createPerson({
      linkedinUrl: 'https://www.linkedin.com/in/sample-user/',
      name: 'Sample User',
      currentPosition: 'Staff Engineer',
      location: 'Sample City, State, Country',
      about: 'Building resilient data systems.',
      openToWork: false,
      experiences: [],
      educations: [],
      patents: [],
      interests: [],
      accomplishments: [],
      contacts: [],
    })

    expect(getProfileSummary(person)).toEqual({
      name: 'Sample User',
      currentPosition: 'Staff Engineer',
      currentBase: 'Sample City, State, Country',
      about: 'Building resilient data systems.',
    })
  })

  test('falls back to headline and origin when current fields are missing', () => {
    const person = createPerson({
      linkedinUrl: 'https://www.linkedin.com/in/example-profile/',
      headline: 'Product Research Lead',
      origin: 'Example Region',
      openToWork: false,
      experiences: [],
      educations: [],
      patents: [],
      interests: [],
      accomplishments: [],
      contacts: [],
    })

    expect(getProfileSummary(person)).toEqual({
      name: null,
      currentPosition: 'Product Research Lead',
      currentBase: 'Example Region',
      about: null,
    })
  })
})
