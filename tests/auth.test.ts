import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { isLoggedIn } from '../src/auth'
import { BrowserManager } from '../src/browser'

describe('Authentication', () => {
  let browserManager: BrowserManager

  beforeAll(async () => {
    browserManager = new BrowserManager({ headless: true })
    await browserManager.start()
  })

  afterAll(async () => {
    await browserManager.close()
  })

  test('isLoggedIn returns false on public pages', async () => {
    const page = browserManager.page
    await page.goto('https://www.google.com')
    const loggedIn = await isLoggedIn(page)
    expect(loggedIn).toBe(false)
  })

  test('isLoggedIn returns false on LinkedIn login page', async () => {
    const page = browserManager.page
    await page.goto('https://www.linkedin.com/login')
    const loggedIn = await isLoggedIn(page)
    expect(loggedIn).toBe(false)
  })
})
