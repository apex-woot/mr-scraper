# @apex-woot/mr-scraper

[![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A high-performance LinkedIn person-profile scraper for **Bun + Node.js**. Built with **Playwright** and **Zod** for robust automation and type-safe data extraction.

## Features

- **Dual Runtime Support:** Optimized builds for both **Bun** and **Node.js** natively.
- **Data Extraction:** LinkedIn person profiles.
- **New Extraction Architecture:** `PageExtractor -> TextExtractor -> Parser` pipeline for resilient section parsing.
- **Resume Export Automation:** Optionally click profile `More -> Save to PDF` and save generated resume locally.

- **Type Safety:** Full TypeScript support with Zod-validated schemas.
- **Session Management:** Persist authentication via `storageState` to bypass logins.
- **Extensible:** Custom callbacks for real-time progress tracking (JSON, Multi, Console).

### 🚀 Improved Robustness

| Feature | Python Version | This Version |
| :--- | :---: | :---: |
| **Experience** | Basic | **Robust & Detailed** |
| **Patents** | Limited | **Full Extraction** |
| **Data Validation** | Pydantic | **Strict Zod Schemas** |
| **Concurrency** | Threading | **Modern Async/Await** |

## Session Persistence

To avoid repeated logins and bot detection, save and reuse your session state:

```typescript
// Save session
await loginWithCredentials(page, { email, password });
await browser.context.storageState({ path: 'state.json' });

// Reuse session
const browser = new BrowserManager({ storageState: 'state.json' });
await browser.start();
```

## Hybrid Scraping (Record in Playwright, Replay in Rust)

If you want a high-throughput Rust scraper, a practical approach is to:

- Use Playwright once to authenticate (login / checkpoints)
- Record the session headers from a real Voyager API request
- Replay those headers with a lightweight Rust HTTP client

Record a replay artifact:

```bash
bun run scrape:session:rust -- "https://www.linkedin.com/in/sample-user/" --out sessions/voyager-session.json
```

Capture Voyager requests while running the full person scrape (recommended for building a Rust API scraper, since the existing scrape already triggers the needed Voyager traffic):

```bash
bun run scrape:profile:voyager -- "https://www.linkedin.com/in/sample-user/"
```

This writes:

- `sessions/voyager-session.json` (cookie/csrf/user-agent for replay)
- `sessions/voyager-requests.json` (deduped list of Voyager request URLs + selected headers)

The recorder writes a JSON file containing `cookieHeader`, `csrfToken`, and `userAgent` from a Voyager request.

Minimal Rust replay example (placeholders):

```rust
use reqwest::header;
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
struct Session {
    cookieHeader: String,
    csrfToken: String,
    userAgent: String,
    restliProtocolVersion: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let raw = fs::read_to_string("sessions/voyager-session.json")?;
    let s: Session = serde_json::from_str(&raw)?;

    let mut headers = header::HeaderMap::new();
    headers.insert(header::COOKIE, s.cookieHeader.parse()?);
    headers.insert("csrf-token", s.csrfToken.parse()?);
    headers.insert(header::USER_AGENT, s.userAgent.parse()?);
    headers.insert("x-restli-protocol-version", s.restliProtocolVersion.parse()?);

    let client = reqwest::Client::builder().default_headers(headers).build()?;
    let resp = client
        .get("https://www.linkedin.com/voyager/api/identity/profiles/sample-user")
        .send()
        .await?;

    println!("status: {}", resp.status());
    Ok(())
}
```

Notes:

- The `csrf-token` header must be consistent with `JSESSIONID`.
- Cookies are IP-bound in practice (record and replay on the same IP / proxy).

## Development

```bash
bun install    # Setup
bun test       # Run tests
bun run build  # Build dist
bun run scrape:summary -- "https://www.linkedin.com/in/sample-user/" --print
```

## Package Registry

This package is published to GitHub Packages (private registry).

Add this to your user/project `.npmrc` before installing:

```ini
@apexwoot:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
always-auth=true
```

## Infisical Integration

This repo can pull runtime secrets from Infisical using the configured project ID `7b57b769-9557-4449-9d88-261cd09a31c2`.

1. Install and authenticate Infisical CLI.
2. Set optional runtime selectors:

```bash
export INFISICAL_ENV=production
export INFISICAL_PATH=/
```

`INFISICAL_ENV` defaults to `production` in this repo.

3. Run scraper commands with Infisical-injected env vars:

```bash
bun run scrape:details:infisical -- "https://www.linkedin.com/in/sample-user/overlay/contact-info/" --print
```

4. Publish package with Infisical-injected registry token:

```bash
bun run publish:infisical
```

## Architecture

- `Page Extractors` locate section roots/items and handle navigation.
- `Text Extractors` pull normalized text/links from DOM elements.
- `Parsers` convert extracted text into typed person models.
- The orchestrator uses this pipeline for all person sections (top card, about, experience, education, patents, interests, accomplishments, contacts).

## Person Support (Current)

The `scrapePerson` flow currently supports these profile sections end-to-end:

- Experience
- Education
- Patents
- Publications (via the `accomplishments` section with `category: "publication"`)
- Contact info

All sections use best-effort extraction and may return partial results if a specific card is missing or fails to parse.

## Parsed Fields By Section

### Experience (`person.experiences[]`)

- `company`
- `companyUrl`
- `positions[]`
  - `title`
  - `employmentType`
  - `fromDate`
  - `toDate`
  - `duration`
  - `location`
  - `description`
  - `plainText`
- `plainText`

### Education (`person.educations[]`)

- `institutionName`
- `degree`
- `linkedinUrl`
- `fromDate`
- `toDate`
- `description`
- `plainText`

### Patents (`person.patents[]`)

- `title`
- `issuer`
- `number`
- `issuedDate`
- `url`
- `description`
- `plainText`

### Publications (`person.accomplishments[]` filtered by `category === "publication"`)

- `category`
- `title`
- `issuer`
- `issuedDate`
- `credentialId`
- `credentialUrl`
- `description`
- `plainText`

### Contact Info (`person.contacts[]`)

- `type` (for example: `linkedin`, `website`, `email`, `phone`, `twitter`, `birthday`, `address`)
- `value`
- `label`
- `plainText`

### Generated Resume PDF

- `person.resumeDownloadLink` is captured by default when the profile exposes `More -> Save to PDF`.
- Enable file download in `scrapePerson` options with:

```typescript
const person = await scrapePerson(page, linkedinUrl, {
  resume: {
    enabled: true,
    outputDir: './downloads',
    // optional: fileName: 'sample-user-resume.pdf'
  },
})
```

- Result field: `person.resumePdfPath` (absolute path), or `undefined` when unavailable.
- Link field: `person.resumeDownloadLink` (ephemeral download URL), or `undefined` when unavailable.

## Roadmap / TODO

- [x] High-performance Bun + Playwright core
- [x] Robust extraction across person sections (Experience, Education, Patents, Interests, Accomplishments, Contacts, Top card, About)
- [ ] Proxy support integration
- [ ] LinkedIn Messaging scraping support
- [ ] Recruiter-specific data points
- [ ] Automated CAPTCHA solving hooks

---

*Disclaimer: This tool is for educational purposes only. Users are responsible for complying with LinkedIn's Terms of Service.*

<small>TypeScript port of [linkedin_scraper](https://github.com/joeyism/linkedin_scraper) by [joeyism](https://github.com/joeyism) done mostly by AI.</small>
