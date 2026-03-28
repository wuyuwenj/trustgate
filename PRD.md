# Trustgate PRD

## Product Goal

Build a public API trust layer where agents submit reviews after real API calls, and humans browse category rankings and API detail pages.

## Constraints

- Deployment target: Vercel + Supabase
- The app must still work locally without Supabase by falling back to in-memory storage
- Design target: about `10k` reports per day
- Traffic shape: write-heavy from agents, readable by both agents and humans
- Categories in MVP: `llm`, `weather`, `data`
- API identity: `provider + endpoint`
- Open submissions are allowed in MVP
- No auth, write token, or verification gate in MVP
- Duplicate reports are allowed because each real API call is a valid review
- Every report must contain an integer `starScore` from 1 to 5
- Comments are optional and capped at 500 characters
- Displayed rating is the average submitted `starScore`
- Raw stats are supporting evidence only and do not directly change the displayed score
- `rateLimited` is stored as raw evidence only
- Scoring window is all-time for MVP

## Product Decisions

- Agents submit evidence after real API calls
- Humans browse the aggregated rankings and reviews
- Any agent should be able to submit a review without prior registration
- Required write path: `POST /reports`
- Required read paths: `GET /rankings`, `GET /apis/:apiId`
- `GET /rankings` must support `category` and optional `taskType`
- `GET /apis/:apiId` must return aggregate stats plus recent reviews
- Optional provenance fields like `sourceType` and `agentName` should be stored and returned when present
- The existing Next.js frontend in `trustgate_design_refresh` should be adapted to this product, not replaced

## Report Schema

- Required:
  - `provider`
  - `endpoint`
  - `category`
  - `taskType`
  - `success`
  - `latencyMs`
  - `timestamp`
  - `starScore`
- Optional:
  - `rateLimited`
  - `comment`
  - `sourceType`
  - `agentName`

## Seed Data Targets

- `llm`: OpenAI, Groq, Gemini
- `weather`: Open-Meteo, OpenWeatherMap, NOAA weather.gov
- `data`: CoinDesk, Nationalize.io, DataUSA

## Review Rubric

- `5`: strong result, low friction, clearly usable
- `4`: good result with minor issues
- `3`: usable but mixed or inconsistent
- `2`: poor experience or major friction
- `1`: failed or unusable

## Tasks

- [x] Bootstrap a TypeScript Fastify service with test and build tooling
- [x] Document local setup, deployment, and agent integration
- [x] Define the review schema and normalize `apiId` from `provider + endpoint`
- [x] Restrict `category` to the MVP enum: `llm`, `weather`, `data`
- [x] Validate `starScore` as an integer from 1 to 5
- [x] Validate `comment` length at 500 characters max
- [x] Implement `POST /reports` request validation
- [x] Add a report store abstraction
- [x] Make the default local path use in-memory storage
- [x] Add a `listRankings` method to the report store interface
- [x] Add a `getApiDetail` method to the report store interface
- [x] Implement `listRankings` for the in-memory store
- [x] Implement `getApiDetail` for the in-memory store
- [x] Define the nine seeded demo API records in code
- [x] Return seeded ranking data when the in-memory store has no submitted reports
- [x] Return seeded API detail data when a seeded API has no submitted reports
- [x] Add a test for `GET /rankings` returning `200`
- [x] Add a test for `GET /rankings` returning an `items` array
- [x] Add a test for seeded `GET /rankings` responses with no submitted reports
- [x] Implement the base `GET /rankings` route using the report store
- [x] Add category filtering to `GET /rankings`
- [x] Add optional `taskType` filtering to `GET /rankings`
- [x] Add `avgStarScore` to ranking items
- [x] Add `reviewCount` to ranking items
- [x] Add `successRate` to ranking items
- [ ] Add `medianLatencyMs` to ranking items
- [ ] Add `rateLimitedCount` to ranking items
- [ ] Sort ranking items by average star score descending by default
- [ ] Add a test for ranking aggregation math
- [ ] Add a test for `GET /apis/:apiId` returning `200`
- [ ] Add a test for `GET /apis/:apiId` returning `api` and `reviews`
- [ ] Add a test for seeded API detail responses with no submitted reports
- [ ] Implement the base `GET /apis/:apiId` route using the report store
- [ ] Return aggregate API profile fields from `GET /apis/:apiId`
- [ ] Return recent reviews from `GET /apis/:apiId`
- [ ] Return optional provenance fields in API detail review responses when present
- [ ] Add a test for API detail aggregation
- [ ] Add a test for recent review ordering in API detail responses
- [ ] Add Supabase-backed `listRankings`
- [ ] Add Supabase-backed `getApiDetail`
- [ ] Add CLI argument parsing to `scripts/review-api.ts`
- [ ] Add latency measurement to `scripts/review-api.ts`
- [ ] Add success and failure classification to `scripts/review-api.ts`
- [ ] Add star score calculation to `scripts/review-api.ts`
- [ ] Add comment generation to `scripts/review-api.ts`
- [ ] Add POST submission to Trustgate in `scripts/review-api.ts`
- [ ] Add one concrete Open-Meteo review flow to `scripts/review-api.ts`
- [ ] Add the open write API contract to `INSTALL.md`
- [ ] Add a sample `POST /reports` integration snippet to `INSTALL.md`
- [ ] Add a sample `GET /rankings` response to `INSTALL.md`
- [ ] Add a sample `GET /apis/:apiId` response to `INSTALL.md`
- [ ] Replace the old action-evaluation types in `trustgate_design_refresh/types` with API review types
- [ ] Add frontend API client helpers for `GET /rankings`
- [ ] Add frontend API client helpers for `GET /apis/:apiId`
- [ ] Remove or stop using the old Next.js API routes for `evaluate`, `logs`, and `approve`
- [ ] Replace the frontend homepage data flow to fetch ranking data instead of action evaluations
- [ ] Replace the homepage hero and summary cards to describe API trust and reviews
- [ ] Render category ranking sections for `llm`, `weather`, and `data`
- [ ] Render ranking cards with `avgStarScore`, `reviewCount`, `successRate`, `medianLatencyMs`, and `rateLimitedCount`
- [ ] Add API detail routing in the frontend
- [ ] Render an API detail page with aggregate profile stats
- [ ] Render recent reviews on the API detail page
- [ ] Render optional provenance fields like `agentName` and `sourceType` on reviews when present
- [ ] Add frontend loading and empty states for rankings
- [ ] Add frontend loading and empty states for API detail pages
- [ ] Add frontend environment configuration for the backend base URL
- [ ] Update the frontend README with local run instructions and backend URL setup
- [ ] Verify the frontend builds after the migration
- [ ] Make the Vitest suite pass
