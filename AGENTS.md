# Agent Guidelines

## Open Source Privacy Requirement

This is an open source project. Do not include real personal information in committed code, tests, fixtures, examples, docs, or issue repro artifacts.

- Use placeholders for identity data (for example: `sample-user`, `example-company`, `example.test`).
- Do not commit real LinkedIn profile URLs, names, emails, phone numbers, or scraped personal payloads.
- If reproducing a parsing bug, sanitize all user-identifying values before committing.

## Repository Focus

- Package name: `@apexwoot/mr-scraper`
- Runtime/tooling: Bun, Playwright, Zod, Biome, TypeScript strict mode
- Primary goal: reliable LinkedIn person profile extraction with typed outputs

## Architecture You Should Respect

- Prefer the extraction pipeline flow: `PageExtractor -> TextExtractor -> Parser`.
- Keep selectors and scrape heuristics centralized (`src/extraction/registry.ts`, `src/config/constants.ts`) rather than scattering literals.
- Preserve schema-first modeling in `src/models/person.ts` (Zod schema + inferred TypeScript types).
- Keep extraction resilient: support fallbacks, partial results, and non-fatal failures where possible.

## Change Guidelines for Agents

- Make small, targeted changes; avoid broad rewrites unless explicitly requested.
- Follow existing naming and module boundaries under `src/extraction/*` and `src/scrapers/person/*`.
- Do not introduce `any`; keep strict typing and explicit return types on exported APIs.
- Reuse existing helpers (`common-patterns`, parser utils, constants) before adding new ones.
- When updating fragile scraping logic, document assumptions in `.FRAGILE-AREAS.md` if behavior changes materially.

## Validation Checklist

Run the smallest meaningful checks first, then expand as needed:

1. `bun test:fast`
2. `bun test`
3. `bun run lint`
4. `bun run build`

If a full run is too expensive for the task, clearly state what was run and what was skipped.

## Scraping Robustness Expectations

- Prefer selector sets with fallbacks over a single brittle selector.
- Avoid assuming one HTML structure; LinkedIn markup changes frequently.
- Keep date parsing compatible with current keywords in `DATE_PATTERNS.CURRENT_KEYWORDS`.
- Maintain deduplication behavior when modifying parsers/extractors.
- Favor best-effort extraction over hard failure when one section cannot be parsed.
