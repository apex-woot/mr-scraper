# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript port of the Python `linkedin_scraper` library. Scrapes LinkedIn profiles, companies, and job listings using **Playwright** (replacing Selenium) and **Zod** (replacing Pydantic).

## Tech Stack

- **Runtime:** Bun
- **Browser Automation:** Playwright
- **Validation:** Zod schemas with exported types
- **Testing:** bun:test

## Commands

**Install dependencies:**
```bash
bun install
```

**Run the scraper:**
```bash
bun run index.ts
```

**Run tests:**
```bash
bun test
```

**Run a single test file:**
```bash
bun test path/to/file.test.ts
```

## Code Standards

### 1. Strict Typing
- Use **Zod** for all data validation
- Export `type` definitions inferred from Zod schemas: `export type Person = z.infer<typeof PersonSchema>`
- No `any` types

### 2. Modern Async Patterns
- All browser interactions use `async/await`
- Use `await page.waitForSelector()` instead of sleep loops
- Use `Promise.all()` for independent scraping tasks

### 3. Class Design
- Use **options objects** for constructors:
  ```typescript
  // Good
  new Person({ linkedinUrl: "...", page, scrape: true })

  // Bad
  new Person("url", page, true)
  ```
- Keep browser state private: `private page: Page`
- Expose data via public readonly properties or getters

### 4. Playwright Patterns
- Use `page.locator()` for element selection
- Prefer `page.waitForSelector()` over arbitrary waits
- Handle navigation with `page.goto()` and `page.waitForLoadState()`

## TypeScript Configuration

- **Target:** ESNext with bundler module resolution
- **Strict mode:** Enabled
- **Module system:** Preserve with bundler resolution
- `allowImportingTsExtensions` enabled
