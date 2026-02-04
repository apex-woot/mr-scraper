import { describe, expect, test } from 'bun:test'
import { loadCredentialsFromEnv } from '../src/auth'

describe('Authentication Utils', () => {
  test('loadCredentialsFromEnv returns credentials from env', () => {
    const originalEmail = process.env.LINKEDIN_EMAIL
    const originalPassword = process.env.LINKEDIN_PASSWORD

    process.env.LINKEDIN_EMAIL = 'test@example.com'
    process.env.LINKEDIN_PASSWORD = 'test123'

    const creds = loadCredentialsFromEnv()

    expect(creds.email).toBe('test@example.com')
    expect(creds.password).toBe('test123')

    // Restore original values
    if (originalEmail) process.env.LINKEDIN_EMAIL = originalEmail
    else delete process.env.LINKEDIN_EMAIL
    if (originalPassword) process.env.LINKEDIN_PASSWORD = originalPassword
    else delete process.env.LINKEDIN_PASSWORD
  })

  test('loadCredentialsFromEnv returns undefined when no env vars', () => {
    const originalEmail = process.env.LINKEDIN_EMAIL
    const originalPassword = process.env.LINKEDIN_PASSWORD
    const originalUsername = process.env.LINKEDIN_USERNAME

    delete process.env.LINKEDIN_EMAIL
    delete process.env.LINKEDIN_PASSWORD
    delete process.env.LINKEDIN_USERNAME

    const creds = loadCredentialsFromEnv()

    expect(creds.email).toBeUndefined()
    expect(creds.password).toBeUndefined()

    // Restore original values
    if (originalEmail) process.env.LINKEDIN_EMAIL = originalEmail
    if (originalPassword) process.env.LINKEDIN_PASSWORD = originalPassword
    if (originalUsername) process.env.LINKEDIN_USERNAME = originalUsername
  })

  test('loadCredentialsFromEnv accepts LINKEDIN_USERNAME as email', () => {
    const originalEmail = process.env.LINKEDIN_EMAIL
    const originalUsername = process.env.LINKEDIN_USERNAME

    delete process.env.LINKEDIN_EMAIL
    process.env.LINKEDIN_USERNAME = 'testuser'

    const creds = loadCredentialsFromEnv()

    expect(creds.email).toBe('testuser')

    // Restore original values
    if (originalEmail) process.env.LINKEDIN_EMAIL = originalEmail
    else delete process.env.LINKEDIN_EMAIL
    if (originalUsername) process.env.LINKEDIN_USERNAME = originalUsername
    else delete process.env.LINKEDIN_USERNAME
  })
})
